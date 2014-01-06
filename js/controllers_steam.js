/* jshint unused: false */
/* global angular, watchGlobals, themify, doAjax, getAjax, getAlternateSearchTerms
, getFields, moment, tallyCounts, checkSearchWarnings, describeChart_time, describeChart_distribution
, describeChart_countComparison, describeChart_crossComparison, prepareData_time, prepareData_distribution
, prepareData_countComparison, prepareData_crossComparison, drawChart
, flattenSearchRecords, extractMessageByID */

/////////////////////////////////////
// Controller for the Connect page //
/////////////////////////////////////

function ConnectController($scope, $http, $timeout, stateTracker) {
	$scope.steam_apiKey = null;
	$scope.cache_expiry = null;
	$scope.cache_expiry_unit = 1;

	// On load, fetch the application configuration
	$http.get("controller.php?task=getConfig")
	.success(function(configData) {
		if(typeof configData == "string")
			configData = JSON.parse(configData);

		// Initialize settings
		$scope.steam_apiKey = configData.steam.apiKey;
		$scope.cache_expiry = parseFloat(configData.search.gamesListExpiry);

		window.apiExplorerGlobals.config = configData;
	});

	// Track the save statuses
	$scope.stateTracker = stateTracker;
	$scope.saveState = stateTracker.startTracker();
	$scope.clearState = stateTracker.startTracker();

	// Save any updates to the API settings
	$scope.save = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.saveState);

		// Prepare the task details
		var params = {
			"task": "updateConfig"
			, "steam_apiKey": $scope.steam_apiKey
			, "search_gamesListExpiry": $scope.cache_expiry < 0 ? -1 : ($scope.cache_expiry * $scope.cache_expiry_unit)
		};

		// Issue the save request to the server
		doAjax(params, function(saveResult) {
			if(typeof saveResult == "string")
				saveResult = JSON.parse(saveResult);

			// On success...
			if(saveResult.status === 1) {
				// ...mark the progress status as completed
				stateTracker.setCompleted($scope.saveState);
				$scope.$apply();
			}
		});
	};

	// Issue a request to clear all the cache
	$scope.clearCache = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.clearState);

		var params = {
			"task" : "clearCache"
		};

		doAjax(params, function(clearResult) {
			if(typeof clearResult == "string")
				clearResult = JSON.parse(clearResult);

			// On success...
			if(clearResult.status === 1) {
				// ...mark the progress status as completed
				stateTracker.setCompleted($scope.clearState);

				$scope.$apply();
			}
		});
	};

	$scope.$watch("cache_expiry_unit", function(newValue, oldValue) {
		if($scope.cache_expiry)
			$scope.cache_expiry = $scope.cache_expiry * oldValue / newValue;
	});
}

///////////////////////////////////
// Controller for the Games page //
///////////////////////////////////

function GamesController($scope, $http, $filter, $q, $timeout, stateTracker, ngTableParams) {
	// List of games available on Steam
	$scope.games = {};
	$scope.games.list = [];
	$scope.games.news = [];
	$scope.games.achievements = [];
	$scope.games.userStats = [];

	// Selected game for news
	$scope.games.selectedGame = {};
	$scope.games.selectedGame.count = 20;
	$scope.games.selectedGame.maxLength = 9999;

	// Track the progress
	$scope.stateTracker = stateTracker;
	$scope.games.listState = stateTracker.startTracker(stateTracker.once); // game list loading
	$scope.games.zoomState = stateTracker.startTracker(stateTracker.once); // game details overall
	$scope.games.zoomState_news = stateTracker.startTracker(stateTracker.once); // game news loading
	$scope.games.zoomState_achievements = stateTracker.startTracker(stateTracker.once); // game achievements loading
	$scope.games.zoomState_userStats = stateTracker.startTracker(stateTracker.once); // user stats loading

	// Table data
	$scope.tableParams_games = null;
	$scope.tableParams_userStats = null;

	// On load, fetch the list of games

	// Mark state is in progress
	stateTracker.setInProgress($scope.games.listState);

	$http.get("controller.php?task=getGamesList")
	.success(function(gamesList) {
		if(typeof gamesList === "string")
			gamesList = angular.toJson(gamesList);

		var processedGamesList = [];
		angular.forEach(gamesList, function(game, index) {
			this.push({
				id: $scope.getID(game.id) // zero-pad to allow string sorting of numbers
				, name: game.name
				, type: game.type
			});
		}, processedGamesList);

		$scope.games.list = processedGamesList;

		// Make available globally
		window.window.apiExplorerGlobals.config.gamesList = processedGamesList;

		// Mark progress as complete
		stateTracker.setCompleted($scope.games.listState);
	});

	// Construct the table replete with sorting,
	// filtering and pagination
	$scope.initTable_games = function() {
		$scope.tableParams_games = new ngTableParams({
			page: 1 // show first page
			, count: 10 // count per page
			, sorting: { // initial sorting
				id: "asc"
			}
		}
		, {
			total: $scope.games.list.length // length of data
			, getData: function($defer, params) {
				// First, filter the data
				var filteredData = params.filter()
					? $filter('filter')($scope.games.list, params.filter())
					: $scope.games.list;

				// Next, sort the data
				var sortedData = params.sorting()
					? $filter('orderBy')(filteredData, params.orderBy())
					: filteredData;

				// Finally, recompute pagination from this result
                params.total(sortedData.length);

				// Last, paginate and display the data
				$defer.resolve(sortedData.slice(
					(params.page() - 1) * params.count()
					, params.page() * params.count()
				));

				// Handle long texts automatically when the table has been rendered
				$timeout(
					function() {
						$(document).ready(function() {
							$(".readmore").readmore({
								moreLink: "<button type='button' class='btn btn-link'>(show more)</button>"
								, lessLink: "<button type='button' class='btn btn-link'>(show less)</button>"
							});
						});
					}
					, 1000
				);
			}
		});
	};

	// Bind the games list with the table
	// Automatically populate the table with the latest list
	$scope.$watch("games.list", function () {
		if(!$scope.tableParams_games)
			$scope.initTable_games(); // create one the first time
		else
			$scope.tableParams_games.reload(); // reload afterwards
	});

	// Prepare a list of game types to be made available as table filter
	$scope.getTypes = function() {
		var types = [];

		angular.forEach($scope.games.list, function(game, index) {
			if(types.indexOf(game.type) < 0)
				types.push(game.type);
		});

		return types;
	};

	$scope.getID = function(id) {
		id = id.split("");
		while(id.length < 10)
			id.unshift("0");
		return id.join("");
	};

	// Zoom into a selected game on the table
	// to see all the game news
	$scope.zoomInto = function(game) {

		// Mark as the selected game
		angular.extend($scope.games.selectedGame, game);

		// Load the news
		$scope.loadNews();

		// Get game achievements
		$scope.getAchievements();
	};

	// Fetch the selected game's news off Steam (or our cache)
	$scope.loadNews = function() {

		// Mark state is in progress
		stateTracker.setInProgress($scope.games.zoomState_news);
		stateTracker.setInProgress($scope.games.zoomState);

		// Get game news
		var params = {
			"task": "getGameNews"
			, "gameID": $scope.games.selectedGame.id
			, "count": $scope.games.selectedGame.count
			, "maxLength": $scope.games.selectedGame.maxLength
		};

		doAjax(params, function(gameNews) {
			// If nothing found...
			if(!gameNews) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_news);

				$scope.$apply();
				return;
			}

			if(typeof gameNews == "string")
				gameNews = JSON.parse(gameNews);

			// Set the news to show
			$scope.games.news = gameNews.appnews.newsitems;

			// If nothing found...
			if(!$scope.games.news || $scope.games.news.length <= 0) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_news);

				$scope.$apply();
				return;
			}

			// ...mark the progress status as completed
			stateTracker.setCompleted($scope.games.zoomState_news);
			stateTracker.setCompleted($scope.games.zoomState);

			$scope.$apply();

			// Handle long texts automatically when the table has been rendered
			$timeout(
				function() {
					$(document).ready(function() {
						$(".readmore").readmore({
							moreLink: "<button type='button' class='btn btn-link'>(show more)</button>"
							, lessLink: "<button type='button' class='btn btn-link'>(show less)</button>"
						});
					});
				}
				, 1000
			);
		});
	};

	// Fetch the selected game's global/user achievements
	$scope.getAchievements = function() {
		if($scope.games.selectedGame.selectedUser)
			$scope.getUserAchievements();
		else
			$scope.getGlobalAchievements();
	};

	// Fetch the selected game's global achievements
	$scope.getGlobalAchievements = function() {

		// Mark state is in progress
		stateTracker.setInProgress($scope.games.zoomState_achievements);
		stateTracker.setInProgress($scope.games.zoomState);

		// Get game news
		var params = {
			"task": "getGameGlobalAchievements"
			, "gameID": $scope.games.selectedGame.id
		};

		doAjax(params, function(globalAchievements) {
			// If nothing found...
			if(!globalAchievements) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_achievements);

				$scope.$apply();
				return;
			}

			if(typeof globalAchievements == "string")
				globalAchievements = JSON.parse(globalAchievements);

			// Set the global achievements to show
			$scope.games.achievements = globalAchievements.achievementpercentages.achievements;

			// If nothing found...
			if(!$scope.games.achievements || $scope.games.achievements.length <= 0) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_achievements);

				$scope.$apply();
				return;
			}

			// ...mark the progress status as completed
			stateTracker.setCompleted($scope.games.zoomState_achievements);
			stateTracker.setCompleted($scope.games.zoomState);

			$scope.$apply();
		});
	};

	// Fetch the selected user's achievements on this game
	$scope.getUserAchievements = function() {

		// Mark state is in progress
		stateTracker.setInProgress($scope.games.zoomState_achievements);
		stateTracker.setInProgress($scope.games.zoomState);

		// Get game news
		var params = {
			"task": "getGameUserAchievements"
			, "gameID": $scope.games.selectedGame.id
			, "userID": $scope.games.selectedGame.selectedUser
		};

		doAjax(params, function(userAchievements) {
			// If nothing found...
			if(!userAchievements) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_achievements);

				$scope.$apply();
				return;
			}

			if(typeof userAchievements == "string")
				userAchievements = JSON.parse(userAchievements);

			// Set the achievements to show
			$scope.games.achievements = userAchievements.playerstats.achievements;

			// If nothing found...
			if(!$scope.games.achievements || $scope.games.achievements.length <= 0) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_achievements);

				$scope.$apply();
				return;
			}

			// ...mark the progress status as completed
			stateTracker.setCompleted($scope.games.zoomState_achievements);
			stateTracker.setCompleted($scope.games.zoomState);

			$scope.$apply();
		});
	};

	// Prettify the names of the achievements
	$scope.prettyAchievement = function(achievement) {
		if(!achievement)
			return achievement;

		// Convert to separate words
		var words = achievement.replace(/[_\.]/g, " ").split(" ");

		// First word is usually a game acronym
		// Set all other words to lowercase
		for(var i = 1, len = words.length; i < len; i++)
			words[i] = angular.lowercase(words[i]);

		return words.join(" ");
	};

	// Construct the table replete with sorting,
	// filtering and pagination
	$scope.initTable_userStats = function() {
		$scope.tableParams_userStats = new ngTableParams({
			page: 1 // show first page
			, count: 10 // count per page
			, sorting: { // initial sorting
				type: "asc"
			}
		}
		, {
			total: $scope.games.userStats.length // length of data
			, getData: function($defer, params) {
				// First, filter the data
				var filteredData = params.filter()
					? $filter('filter')($scope.games.userStats, params.filter())
					: $scope.games.userStats;

				// Next, sort the data
				var sortedData = params.sorting()
					? $filter('orderBy')(filteredData, params.orderBy())
					: filteredData;

				// Finally, recompute pagination from this result
                params.total(sortedData.length);

				// Last, paginate and display the data
				$defer.resolve(sortedData.slice(
					(params.page() - 1) * params.count()
					, params.page() * params.count()
				));
			}
		});
	};

	// Bind the stats with the table
	// Automatically populate the table with the latest stats
	$scope.$watch("games.userStats", function () {
		if(!$scope.tableParams_userStats)
			$scope.initTable_userStats(); // create one the first time
		else
			$scope.tableParams_userStats.reload(); // reload afterwards
	});

	// Fetch the selected user's stats on this game
	$scope.getUserStats = function() {

		// Mark state is in progress
		stateTracker.setInProgress($scope.games.zoomState_userStats);

		// Get game news
		var params = {
			"task": "getUserStats"
			, "gameID": $scope.games.selectedGame.id
			, "userID": $scope.games.selectedGame.selectedUser
		};

		doAjax(params, function(userStats) {
			// If nothing found...
			if(!userStats) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_userStats);

				$scope.$apply();
				return;
			}

			if(typeof userStats == "string")
				userStats = JSON.parse(userStats);

			// Set the user stats to show
			$scope.games.userStats = [];

			var achievements = userStats.playerstats.achievements;
			angular.forEach(achievements, function(value, key) {
				$scope.games.userStats.push({
					type: "Achievement"
					, name: value.name
					, value: value.achieved
				});
			});

			var stats = userStats.playerstats.stats;
			angular.forEach(stats, function(value, key) {
				$scope.games.userStats.push({
					type: "Statistics"
					, name: value.name
					, level: value.value
				});
			});

			// If nothing found...
			if(!$scope.games.userStats || $scope.games.userStats.length <= 0) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.games.zoomState_userStats);

				$scope.$apply();
				return;
			}

			// ...mark the progress status as completed
			stateTracker.setCompleted($scope.games.zoomState_userStats);
			stateTracker.setCompleted($scope.games.zoomState);

			$scope.$apply();
		});
	};
}

///////////////////////////////////
// Controller for the Users page //
///////////////////////////////////

function UsersController($scope,  stateTracker) {
	// Steam user to search for
	$scope.search = {};
	$scope.search.user = null;
	$scope.search.history = []; // track previous users for going back

	// Search results
	$scope.user = {};
	$scope.user.profile = null;
	$scope.user.games_owned = null;
	$scope.user.games_recentlyPlayed = null;
	$scope.user.friends	 = null;

	// Track the progress of search
	$scope.stateTracker = stateTracker;
	$scope.search.state = stateTracker.startTracker(stateTracker.once);

	$scope.performSearch = function() {

		// Mark state is in progress
		stateTracker.setInProgress($scope.search.state);

		// Get game news
		var params = {
			"task": "getUserDetails"
			, "userID": $scope.search.user
		};

		doAjax(params, function(userDetails) {
			// If nothing found...
			if(!userDetails) {
				// ...mark the progress status as failed
				stateTracker.setFailed($scope.search.state);

				$scope.$apply();
				return;
			}

			if(typeof userDetails == "string")
				userDetails = JSON.parse(userDetails);

			// Extract useful information
			try {
				$scope.user.profile = userDetails.profile.response.players[0];
			} catch(e) {
				$scope.user.profile = null;
			}

			try {
				$scope.user.games_owned = userDetails.ownedGames.response;
			} catch(e) {
				$scope.user.games_owned = null;
			}

			try {
				$scope.user.games_recentlyPlayed = userDetails.recentlyPlayedGames.response;
			} catch(e) {
				$scope.user.games_recentlyPlayed = null;
			}

			try {
				$scope.user.friends = userDetails.friendList;
			} catch(e) {
				$scope.user.friends = null;
			}

			// ...mark the progress status as completed
			stateTracker.setCompleted($scope.search.state);

			$scope.$apply();
		});
	};

	// Fluidly swap the current user with the select one - and fetch their details
	$scope.switchUser = function(userID) {
		// Add current to the history
		$scope.search.history.push($scope.search.user);

		// Replace it with the new one
		$scope.search.user = userID;

		// Fetch profile
		$scope.performSearch();
	};

	// Return back one step into the previous sequence of searches
	$scope.goBack = function() {
		// Get the latest user from the history
		$scope.search.user = $scope.search.history.pop();

		// Fetch profile
		$scope.performSearch();
	};
}