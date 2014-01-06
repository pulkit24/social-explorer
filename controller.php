<?php

/**
-------------------
Application configuration parameters
-------------------
*/
require_once("config.php");
$config = Config::getInstance();

require_once("cache.php");
$cache = Cache::getInstance();

require_once("libraries/twitterAPIExchange/TwitterAPIExchange.php");
$twitterAPISettings = $config->get("twitter");
$twitterAPIMethod = $config->get("twitter", "method");

require_once("games.php");
require_once("search.php");
require_once("searchTracker.php");

$uploadFileDirectory = $config->get("search", "uploadFileDirectory");

if($config->get("search", "noPHPTimeLimit") === true)
	set_time_limit(0);

/**
-------------------
Control dispatcher
-------------------
*/

// Call a function based on the task requested
$task = $_REQUEST["task"];

// App Configuration
if($task === "getConfig")
	echo getConfig();
else if($task === "updateConfig")
	echo updateConfig();
else if($task === "clearCache")
	echo clearCache();

// Social API calls
else if($task === "facebookAPICall")
	echo doFacebookAPIRequest();
else if($task === "twitterAPICall")
	echo doTwitterAPIRequest();
else if($task === "fullSearch")
	echo doFullSearch();

// Steam Web API calls
else if($task === "getGamesList")
	echo getGamesList();
else if($task === "getGameNews")
	echo getGameNews();
else if($task === "getGameGlobalAchievements")
	echo getGameGlobalAchievements();
else if($task === "getGameUserAchievements")
	echo getGameUserAchievements();
else if($task === "getUserStats")
	echo getUserStats();
else if($task === "getUserDetails")
	echo getUserDetails();

/**
-------------------
Task functions
-------------------
*/

// Perform Facebook API calls
// Returns the response as-is
function doFacebookAPIRequest() {
	// Handle API requests
	// Make a basic RESTful call
	global $cache;
	$config = Config::getInstance();
	$API_response = $cache->fetchFile($_REQUEST["url"], $config->get("cache", "expiry"));

	// Return the response back
	return $API_response;
}

// Perform Twitter API calls
// Returns the response as-is
function doTwitterAPIRequest() {
	// Handle API requests
	// Make a basic RESTful call
	global $cache;
	$config = Config::getInstance();
	$API_response = $cache->fetchFile($_REQUEST["url"] . $_REQUEST["params"], (int) $_REQUEST["expiry"], function() {
		// Use the Twitter API library to perform the request
		global $twitterAPISettings, $twitterAPIMethod;
		$twitter = new TwitterAPIExchange((array) $twitterAPISettings);
		return $twitter->setGetfield($_REQUEST["params"])
						->buildOauth($_REQUEST["url"], $twitterAPIMethod)
						->performRequest();
	});

	// Return the response back
	return $API_response;
}

// Perform a full search using both Facebook and Twitter APIs
function doFullSearch() {
	$search = new Search($_REQUEST["accessToken"]);

	$curatedResponse = $search->search(
		$_REQUEST["count_facebook"]
		, $_REQUEST["count_twitter"]
		, $_REQUEST["scope"]
		, $_REQUEST["queries"]
		, filter_var($_REQUEST["relevantOnly"], FILTER_VALIDATE_BOOLEAN)
		, $_REQUEST["queryID"]
	);

	// Return the response back
	return json_encode($curatedResponse);
}

// Let the client fetch the application settings.
function getConfig() {
	$config = Config::getInstance();

	return $config->serialize();
}

// Update a portion of the configuration
// recorded in config.json
function updateConfig() {
	$config = Config::getInstance();

	foreach ($_REQUEST as $key => $value) {
		// Split the key into (key, subKey) pairs
		$keyComponents = split("_", $key, 2);

		// Update the configuration
		$config->set($keyComponents[0], $keyComponents[1], $value);
	}

	// Save the updates
	$config->save();

	return json_encode(array(
		"status" => 1
		, "message" => "Configuration updated successfully."
	));
}

// Clear the cached search results
function clearCache() {
	global $cache;

	// Empty out the cache folder
	$success = $cache->emptyCache();

	return json_encode(array(
		"status" => $success ? 1 : 0
		, "message" => "Cache cleared successfully."
	));
}

// Fetch a list of games currently available on Steam
function getGamesList() {
	$games = new Games();

	$response = $games->getGamesList($_REQUEST["type"]);

	return json_encode($response);
}

// Fetch a list of game news
function getGameNews() {
	$games = new Games();

	$count = $_REQUEST["count"] ? $_REQUEST["count"] : 3;
	$maxLength = $_REQUEST["maxLength"] ? $_REQUEST["maxLength"] : 300;

	return $games->getNews($_REQUEST["gameID"], $count, $maxLength);
}

// Fetch the global game achievements
function getGameGlobalAchievements() {
	$games = new Games();
	return $games->getGlobalAchievements($_REQUEST["gameID"]);
}

// Fetch a user's game achievements
function getGameUserAchievements() {
	$games = new Games();
	return $games->getUserAchievements($_REQUEST["gameID"], $_REQUEST["userID"]);
}

// Fetch a user's stats for a game
function getUserStats() {
	$games = new Games();
	return $games->getUserStats($_REQUEST["gameID"], $_REQUEST["userID"]);
}

// Fetch a user's details
function getUserDetails() {
	$games = new Games();

	$profile = $games->getUserProfile($_REQUEST["userID"]);
	$friends = $games->getUserFriends($_REQUEST["userID"]);
	$ownedGames = $games->getOwnGames($_REQUEST["userID"]);
	$recentGames = $games->getRecentlyPlayedGames($_REQUEST["userID"]);

	return json_encode(array(
		"profile" => json_decode($profile)
		, "friendList" => $friends
		, "ownedGames" => json_decode($ownedGames)
		, "recentlyPlayedGames" => json_decode($recentGames)
	));
}

?>