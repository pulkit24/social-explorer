<?php

require_once("config.php");
$config = Config::getInstance();

if($config->get("search", "noSearchWarnings") === true) {
	error_reporting( E_ERROR | E_USER_ERROR );
	ini_set('display_errors', false);
}

require_once('libraries/twitterAPIExchange/TwitterAPIExchange.php');
$twitterAPISettings = $config->get("twitter");
$twitterAPIMethod = $config->get("twitter", "method");
$twitter_endPoint;
$twitter_queryParams;

require_once('searchTracker.php');

require_once("cache.php");
$cache = Cache::getInstance();

class Search {

	/**
	-------------------
	Search configuration parameters
	-------------------
	*/
	// Global specifications
	private $expiry;

	// Instance-specific configuration
	private $facebookAccessToken;
	private $relevantFieldMap;

	// Search output
	private $map;

	// Search progress tracker
	private $tracker;

	public function __construct($facebookAccessToken) {
		$config = Config::getInstance();

		$this->expiry = $config->get("cache", "expiry");

		$this->relevantFieldMap = (array) $config->get("search", "relevantFieldMap");

		$this->facebookAccessToken = $facebookAccessToken;
	}

	/**
	-------------------
	Main search function
	-------------------
	*/

	public function search($countFacebook, $countTwitter, $scope, $queries, $relevantOnly, $queryID) {
		// Prepare the results output
		$colatedResponse = array();

		$this->tracker = new SearchTracker($queryID);
		$this->tracker->setQueriesExpected(count($scope) * count($queries));

		// Perform the searches
		if(in_array("facebook", $scope)) {
			// Search on Facebook

			// First search for public posts and pages, if requested
			$types = array();
			if(in_array("facebook_publicPosts", $scope)) {
				$types[] = "post";
				$types[] = "place";
			}
			if(in_array("facebook_pages", $scope)) {
				$types[] = "page";
				$types[] = "group";
			}

			foreach($types as $type) {
				foreach($queries as $query) {
					$response = $this->queryFacebook($query, $type, $countFacebook);

					// Colate the result data into the global collection
					if(!empty($response) && !is_object($response))
						$response = json_decode($response);
					$responseData = $response->data;

					foreach($responseData as $key => $value)
						$colatedResponse[] = $value;

					// Update the search tracker
					$this->tracker->incrementQueriesCompleted();
				}
			}

			// Next, search for posts within pages
			if(in_array("facebook_postsInPages", $scope)) {
				$types = array("page", "group");

				foreach($types as $type) {
					foreach($queries as $query) {
						// First, get all the page info
						// (Don't worry, it's all cached now if we've already retrieved them above)
						$response = $this->queryFacebook($query, $type, $countFacebook);

						// Parse the result for all page IDs
						if(!empty($response) && !is_object($response))
							$response = json_decode($response);

						// Create a summary map
						$map = $this->buildMap($response, false);

						// Prepare post types for pages
						$postTypes = array("feed", "statuses");

						// Get the page IDs
						$pageIDs = $map["id"];

						// Now that we know the actual number of pages returned,
						// We can compute the actual number of searches we are making in this run
						$pageCount = count($pageIDs);
						$this->tracker->addQueriesExpected(2 * $pageCount); // includes feed and statuses for each page queried

						// Iterate over each page
						foreach($pageIDs as $pageID => $pageDetails) {

							// Issue an API request to get all the posts
							foreach($postTypes as $postType) {
								$response = $this->queryFacebookPage($pageID, $postType, $countFacebook);

									// Colate the result data into the global collection
									if(!empty($response) && !is_object($response))
										$response = json_decode($response);
									$responseData = $response->data;

									foreach($responseData as $key => $value)
										$colatedResponse[] = $value;

									// Update the search tracker
									$this->tracker->incrementQueriesCompleted();
							}
						}
					}
				}
			}
		}

		if(in_array("twitter", $scope)) {
			// Search on Twitter

			$types = array();
			if(in_array("twitter_recent", $scope)) {
				$types[] = "recent";
			}

			foreach($types as $type) {
				foreach($queries as $query) {
					$response = $this->queryTwitter($query, $type, $countTwitter);

					// Colate the result data into the global collection
					if(!empty($response) && !is_object($response))
						$response = json_decode($response);
					$responseData = $response->statuses;

					foreach($responseData as $key => $value)
						$colatedResponse[] = $value;

					// Update the search tracker
					$this->tracker->incrementQueriesCompleted();
				}
			}
		}

		// Create a flat map
		$this->map = $this->buildMap($colatedResponse, $relevantOnly);
		return $this->map;
	}

	/**
	-------------------
	Mapping utilities
	-------------------
	*/

	// Construct a map aggregating all the fields in the json data
	private function buildMap($jsonData, $relevantOnly) {
		if(!empty($response) && !is_object($response))
			$response = json_decode($response);

		// Map to store the count of each key-value pair
		$map = array();

		// Iterate over all elements
		foreach($jsonData as $dataID => $dataItem) {
			// First, flatten the object
			$flatData = $this->unravel($dataItem);

			// For each element, map the fields
			foreach($flatData as $key => $value) {

				// Skip empty values
				if (empty($value))
					continue;

				// Are we displaying relevant fields only?
				if($relevantOnly) {

					// Yes. Map it to the relevant field name
					if(isset($this->relevantFieldMap[$key]))
						$key = $this->relevantFieldMap[$key];
					else
						continue; // Skip irrelevant fields
				}

				// We'll store the count for each time we encounter this value for this key
				if (empty($map[$key]))
					$map[$key] = array();

				// Initialize the aggregate info stored by the map
				// Also track the original data item IDs to be able to trace back
				if (empty($map[$key][$value])) {
					$map[$key][$value] = array();
					$map[$key][$value]["count"] = 0;
					$map[$key][$value]["id"] = array();
					$map[$key][$value]["id"] = array();
				}

				// Set or increment the count for this value
				$map[$key][$value]["count"] += 1;

				// Note the current data item ID
				$map[$key][$value]["id"][] = $dataID;
			}
		}

		return $map;
	}

	// Utility to unpack a json object into a flat array of key-value pairs
	private function unravel($packedObject, $keyPrefix = null) {
		$flattenedObject = array();

		// Insert every entry into the flattened version
		foreach($packedObject as $key => $value) {
			if(is_object($value))
				$flattenedObject = $this->unravelInto($value, $flattenedObject, $key); // recursively unpack
			else {
				if($keyPrefix)
					$key = $keyPrefix . " " . $key;
				$flattenedObject[$key] = $value; // add the key-value pair directly
			}
		}

		return $flattenedObject;
	}

	// Utility to unpack a json object into another json object
	// Useful for recursively unpacking json into one map of key-value pairs
	private function unravelInto($jsonObject, $existingObject, $keyPrefix = null) {

		// Insert every entry back into the existing object
		foreach($jsonObject as $key => $value) {
			if(is_object($value))
				$existingObject = $this->unravelInto($value, $existingObject); // recursively unpack
			else {
				if(!empty($keyPrefix))
					$key = $keyPrefix . " " . $key;
				$existingObject[$key] = $value; // add the key-value pair directly
			}
		}

		return $existingObject;
	}

	/**
	-------------------
	API functions
	-------------------
	*/

	private function queryFacebook($query, $type, $countFacebook) {
		global $cache;

		$endPoint = "https://graph.facebook.com/search"
			. "?q=" . urlencode($query)
			. "&type=" . urlencode($type)
			. "&limit=" . urlencode($countFacebook)
			. "&access_token=" . urlencode($this->facebookAccessToken);
		return $cache->fetchFile($endPoint, $this->expiry);
	}

	private function queryFacebookPage($pageID, $postType, $countFacebook) {
		global $cache;

		$endPoint = "https://graph.facebook.com/$pageID/" . urlencode($postType)
			. "?limit=$countFacebook"
			. "&access_token=$this->facebookAccessToken"
			. "&lang=en";
		return $cache->fetchFile($endPoint, $this->expiry);
	}

	// private $twitter_endPoint;
	// private $twitter_queryParams;
	private function queryTwitter($query, $type, $countTwitter) {
		global $cache, $twitter_endPoint, $twitter_queryParams;

		$twitter_endPoint = "http://api.twitter.com/1.1/search/tweets.json";
		$twitter_queryParams = "?q=" . urlencode($query) . "&result_type=" . urlencode($type) . "&count=" . urlencode($countTwitter);

		return $cache->fetchFile($twitter_endPoint . $twitter_queryParams, $this->expiry, function() {
			// Use the Twitter API library to perform the request
			global $twitterAPISettings, $twitterAPIMethod, $twitter_endPoint, $twitter_queryParams;
			$twitter = new TwitterAPIExchange((array) $twitterAPISettings);
			return $twitter->setGetfield($twitter_queryParams)
							->buildOauth($twitter_endPoint, $twitterAPIMethod)
							->performRequest();
		});
	}
}
?>
