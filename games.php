<?php

require_once("config.php");
$config = Config::getInstance();

if($config->get("search", "noSearchWarnings") === true) {
	error_reporting( E_ERROR | E_USER_ERROR );
	ini_set('display_errors', false);
}

require_once("cache.php");
$cache = Cache::getInstance();

class Games {

	/**
	-------------------
	Search configuration parameters
	-------------------
	*/
	// Global specifications
	private $expiry;
	private $apiKey;

	// External source for games list
	private $url_gamesList;

	public function __construct() {
		global $config;

		$this->expiry = $config->get("search", "gamesListExpiry");
		$this->url_gamesList = $config->get("search", "gamesListURL");
		$this->apiKey = $config->get("steam", "apiKey");
	}

	// Check whether the given ID is a genuine Steam ID
	private function isSteamID64($userID) {
		return (preg_match("/\D/", $userID) == false) && strlen($userID) === 17;
	}

	// Get the Steam ID if the user's vanity name is available
	private function getSteamID64($username) {
		global $cache;

		// Construct the interface endpoint
		$url = "http://steamcommunity.com/id/$username/?xml=1";

		// Get the raw Steam Community profile
		$rawProfile = $cache->fetchFile($url, $this->expiry);

		// Extract <steamID64>
		$steamID = array();
		preg_match("/<steamID64>(\d+)<\/steamID64>/", $rawProfile, $steamID);

		return $steamID[1];
	}

	/**
	-------------------
	Listing all games
	-------------------
	*/

	// Fetch a list of games currently available on Steam
	// Uses request vars: start, count, and type for filtering
	// Data source: external website (see $config->get("search", "gamesListURL"))
	// Returns:
	// 	array(
	// 		id => Steam app ID
	// 		, name => "Game Name"
	// 		, type => "Demo"
	// 	)
	public function getGamesList($filter_type) {
		// Get the latest raw data from the external source
		global $cache;
		$rawData = $cache->fetchFile($this->url_gamesList, $this->expiry);

		// Process the raw web page
		$locationMatchExpression_appID = "/<\s*span\s+class\s*=\s*[\"']CNA7[\"']\s*>\D*(\d*)\s*:/";
		$locationMatchExpression_gameNameAndType = "/<\s*span\s+class\s*=\s*[\"']CNA7[\"']\s*>\D*\d*\s*:<\/[^<]+<\/\s*span[^<]+<\s*span(\s+class\s*=\s*[\"'](\w+)\s*[\"'])?\s*>\s*([^<]*)</";

		// Get the list of app IDs
		$matches_appID = null;
		preg_match_all($locationMatchExpression_appID, $rawData, $matches_appID);

		if($matches_appID && count($matches_appID) < 2) {

			// Error in parsing
			return array(
				"status" => 0
				, "message" => "App ID matches amount to '.count($matches_appID).'" // ensure we got the data
			);

		} else
			$matches_appID = $matches_appID[1]; // extract the correct set of match results

		// Similarly, get the list of names and types
		$matches_gameNameAndType = null;
		$matches_gameName = null;
		$matches_gameType = null;
		preg_match_all($locationMatchExpression_gameNameAndType, $rawData, $matches_gameNameAndType);

		if($matches_gameNameAndType && count($matches_gameNameAndType) < 3) {

			// Error in parsing
			return array(
				"status" => 0
				, "message" => "Game name/type matches amount to '.count($matches_gameNameAndType).'" // ensure we got the data
			);

		} else {
			$matches_gameName = $matches_gameNameAndType[3]; // extract the correct set of match results
			$matches_gameType = $matches_gameNameAndType[2];
		}

		// Get rid of nulls
		$matches_appID_valid = array();
		foreach($matches_appID as $key => $value)
			if(!empty($value))
				$matches_appID_valid[] = $value;
		// foreach($matches_gameName as $key => $value)
		// 	if(empty($value))
		// 		unset($matches_gameName[$key]);
		// foreach($matches_gameType as $key => $value)
		// 	if(empty($value))
		// 		unset($matches_gameType[$key]);

		// If we miss a single match, the entire list is rendered useless
		$matchCount = count($matches_appID_valid);
		if(count($matches_gameName) != $matchCount || count($matches_gameType) != $matchCount) {
			return array(
				"status" => 0
				, "message" => "Rows matched do not tally: '.$matchCount.' appIDs, '.count($matches_gameName).' names, '.count($matches_gameType).' types" // ensure we got the data
			);
		}

		// Finally! Link them up together in a single, consolidated list
		$gameList = array();
		// for($i = $filter_start; $i < $matchCount && $i < $filter_max; $i++){
		for($i = 0; $i < $matchCount; $i++){

			// Apply the type filter
			$gameType = $this->gameList_getType($matches_gameType[$i]);
			if(!empty($filter_type) && $gameType !== $filter_type)
				continue; // do not add unwanted types

			// Else, add to our final list
			$gameList[] = array(
					"id" => $matches_appID_valid[$i]
					, "name" => $matches_gameName[$i]
					, "type" => $gameType
			);
		}

		return $gameList;
	}

	// Auxiliary function to get the game type from the legend provided on the external source
	public function gameList_getType($typeKey) {
		// Sample, last fetched on 15 Aug 2013
		// 	Automated colors: (aka: can be false sometime)
		// 	Red: Fake / Unused AppID - [found: 2]
		// 	Orange: To be announced AppID (mostly still WIP, Alpha Phase) - [found: 90]
		// 	White: Trailer / Pre-Order - [found: 2282]
		// 	Green: Actual game online (or Beta phase) - [found: 6584]
		// 	Teal: Beta / Press app - [found: 93]
		// 	Blue: Demo - [found: 639]

		$typeKey = strtolower($typeKey);
		if($typeKey === "s_red")
			return "Placeholder / Unused";
		else if($typeKey === "s_orange")
			return "Unannounced / Alpha";
		else if($typeKey === "s_white")
			return "Trailer / Pre-Order";
		else if($typeKey === "s_green")
			return "Game";
		else if($typeKey === "cna5")
			return "Beta";
		else if($typeKey === "s_blue")
			return "Demo";
		else
			return "Trailer / Pre-Order";
	}

	/**
	-------------------
	Steam API interfaces
	-------------------
	*/

	public function getNews($appID, $count, $maxLength) {
		// Get the latest game news from the Steam Web API
		global $cache;

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/"
			. "?appid=$appID&count=$count&maxlength=$maxLength&format=json";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getGlobalAchievements($appID) {
		// Get the game's global achievements
		global $cache;

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/"
			. "?gameid=$appID&format=json";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getUserAchievements($appID, $userID) {
		// Get the user's achievements on this game
		global $cache;

		// Convert a username to the actual user ID
		if(!$this->isSteamID64($userID))
			$userID = $this->getSteamID64($userID);

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/"
			. "?appid=$appID&key={$this->apiKey}&steamid=$userID";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getUserStats($appID, $userID) {
		// Get the user's stats for this game
		global $cache;

		// Convert a username to the actual user ID
		if(!$this->isSteamID64($userID))
			$userID = $this->getSteamID64($userID);

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/"
			. "?appid=$appID&key={$this->apiKey}&steamid=$userID";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getUserProfile($userID, $isBatch = false) {
		// Get the user's profile
		global $cache;

		// For single user profiles, the ID must be valid
		if(!$isBatch) {

			// Convert a username to the actual user ID
			if(!$this->isSteamID64($userID))
				$userID = $this->getSteamID64($userID);

		} // Else - multiple users supplied are assumed to be valid IDs

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
			. "?key={$this->apiKey}&steamids=$userID";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getMultipleUserProfiles($userIDs) {
		$userProfiles = array();

		for($i = 0, $len = count($userIDs); $i < $len; $i += 100) {
			$userBatch = array_slice($userIDs, $i, 100);

			$userCSV = implode(",", $userBatch);

			$fetchedProfiles = $this->getUserProfile($userCSV, true);
			$fetchedProfiles = json_decode($fetchedProfiles);
			$fetchedProfiles = $fetchedProfiles->response->players;

			$userProfiles = array_merge($userProfiles, $fetchedProfiles);
		}

		return $userProfiles;
	}

	public function getUserFriends($userID) {
		// Get the user's friend list
		global $cache;

		// Convert a username to the actual user ID
		if(!$this->isSteamID64($userID))
			$userID = $this->getSteamID64($userID);

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/"
			. "?key={$this->apiKey}&steamid=$userID&relationship=friend";

		$friendsRaw = $cache->fetchFile($url, $this->expiry);
		$processedFriends = array();

		// Collect all the user IDs
		$userIDs = array();
		$friends = json_decode($friendsRaw);
		$friends = $friends->friendslist->friends;
		foreach ($friends as $index => $friend) {
			$userIDs[] = $friend->steamid;

			// Also key the friends by ID for easy reference
			$processedFriends[$friend->steamid] = $friend;
		}

		// Fetch the friend's profile info for their names and such
		$friendProfiles = $this->getMultipleUserProfiles($userIDs);

		// Key up the profiles by ID
		$processedProfiles = array();
		foreach ($friendProfiles as $index => $profile) {
			$processedProfiles[$profile->steamid] = $profile;
		}

		// Join the user profile to the master friend list
		foreach ($processedFriends as $id => $friend) {
			$profile = $processedProfiles[$id];
			$profile->relationship = $friend->relationship;
			$profile->friend_since = $friend->friend_since;
			$processedFriends[$id] = $profile;
		}

		// Return the results
		return array(
			"friendlist" => $processedFriends
			, "total_count" => count($processedFriends)
		);
	}

	public function getOwnGames($userID) {
		// Get the user's owned games
		global $cache;

		// Convert a username to the actual user ID
		if(!$this->isSteamID64($userID))
			$userID = $this->getSteamID64($userID);

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
			. "?key={$this->apiKey}&steamid=$userID&include_appinfo=1&include_played_free_games=1";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}

	public function getRecentlyPlayedGames($userID) {
		// Get the user's recently player games
		global $cache;

		// Convert a username to the actual user ID
		if(!$this->isSteamID64($userID))
			$userID = $this->getSteamID64($userID);

		// Construct the interface endpoint
		$url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
			. "?key={$this->apiKey}&steamid=$userID&include_appinfo=1&include_played_free_games=1";

		// Return the results as-is
		return $cache->fetchFile($url, $this->expiry);
	}
}
?>