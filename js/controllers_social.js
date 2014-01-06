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
	$scope.facebook = {};
	$scope.twitter = {};
	$scope.accessToken = null;
	$scope.cache_expiry = null;
	$scope.cache_expiry_unit = 1;

	// On load, fetch the application configuration
	$http.get("controller.php?task=getConfig")
	.success(function(configData) {
		if(typeof configData == "string")
			configData = JSON.parse(configData);

		// Initialize settings
		$scope.facebook = configData.facebook;
		$scope.twitter = configData.twitter;
		$scope.cache_expiry = parseFloat(configData.cache.expiry);

		window.apiExplorerGlobals.config = configData;

		// Try to connect to Facebook
		/* global connectToFacebook */
		connectToFacebook();

		// Don't test connection to Twitter unless manually requested
		// because Twitter API has a rate limit
		// $scope.testTwitter();
	});

	// Track the save, FB auth and Twitter test statuses
	$scope.stateTracker = stateTracker;
	$scope.saveState = stateTracker.startTracker();
	$scope.facebookState = stateTracker.startTracker(stateTracker.once);
	$scope.twitterState = stateTracker.startTracker(stateTracker.once);
	$scope.clearState = stateTracker.startTracker();

	// Watch any relevant variables from outside angular
	var unbind = watchGlobals.watch(function(updatedGlobals) {

		// Check if we are authed into Facebook already
		// Simple, we must have got an access token if we are
		if(updatedGlobals.accessToken)
			stateTracker.setCompleted($scope.facebookState);
		$scope.$apply();
	});

	// Unbind the listener when the scope is destroyed
	$scope.$on('$destroy', unbind);

	// Save any updates to the API settings
	$scope.save = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.saveState);

		// Also, invalidate the API connection statuses
		stateTracker.invalidate($scope.facebookState);
		stateTracker.invalidate($scope.twitterState);

		// Prepare the task details
		var params = {
			"task": "updateConfig"
			, "facebook_appId": $scope.facebook.appId
			, "twitter_oauth_access_token": $scope.twitter.oauth_access_token
			, "twitter_oauth_access_token_secret": $scope.twitter.oauth_access_token_secret
			, "twitter_consumer_key": $scope.twitter.consumer_key
			, "twitter_consumer_secret": $scope.twitter.consumer_secret
			, "cache_expiry": $scope.cache_expiry < 0 ? -1 : ($scope.cache_expiry * $scope.cache_expiry_unit)
		};

		// Issue the save request to the server
		doAjax(params, function(saveResult) {
			if(typeof saveResult == "string")
				saveResult = JSON.parse(saveResult);

			// On success...
			if(saveResult.status === 1) {
				// ...mark the progress status as completed
				stateTracker.setCompleted($scope.saveState);

				// And reset the connection assessment so that
				// we need to re-auth with FB/re-test Twitter
				$scope.isConnectedToFacebook = false;
				$scope.isConnectedToTwitter = false;

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

	// Connect to the Facebook API
	$scope.connectFacebook = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.facebookState);

		// Reload the page – Facebook will attempt to
		// connect at page start
		window.location.reload(false);
	};

	// Connect to the Twitter API
	$scope.testTwitter = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.twitterState);

		// Perform a small test API call
		var params = {
			"task": "twitterAPICall"
			, "url": "http://api.twitter.com/1.1/search/tweets.json"
			, "params": "?q=test&result_type=recent&count=1"
			, "expiry" : "0"
		};

		doAjax(params, function(twitterResponse) {
			if(typeof twitterResponse == "string")
				twitterResponse = JSON.parse(twitterResponse);

			// Did we get at least 1 tweet?
			if(twitterResponse.statuses) {
				// Yes! Mark as connected
				stateTracker.setCompleted($scope.twitterState);
				$scope.$apply();

			} else {
				// No, authentication failed
				stateTracker.setFailed($scope.twitterState);
				$scope.$apply();
			}

		});
	};
}

////////////////////////////////////
// Controller for the Search page //
////////////////////////////////////
function SearchController($scope, $http, $timeout, stateTracker) {
	// Search options
	$scope.search = {};
	$scope.search.query = "";
	$scope.search.withVariants = true;
	$scope.search.onlyRelevant = true;

	// Track the search state
	$scope.stateTracker = stateTracker;
	$scope.search.state = stateTracker.startTracker(stateTracker.parallel);

	// Sources
	$scope.sources = {};
	$scope.sources.twitter = {};
	$scope.sources.twitter.enabled = true;
	$scope.sources.twitter.count = 100;
	$scope.sources.facebook = {};
	$scope.sources.facebook.enabled = true;
	$scope.sources.facebook.count = 100;
	$scope.sources.facebook.posts = true;
	$scope.sources.facebook.pages = false;
	$scope.sources.facebook.postsInPages = true;

	// Search results and history
	$scope.history = [];
	// Make available globally, for the rest of the application to peruse
	window.apiExplorerGlobals.searchHistory = $scope.history; // tie up by reference

	// Check if any of Facebook sub-sources enabled
	$scope.isFacebookEnabled = function() {
		$scope.sources.facebook.enabled = $scope.sources.facebook.posts
			|| $scope.sources.facebook.pages
			|| $scope.sources.facebook.postsInPages;

		return $scope.sources.facebook.enabled;
	};

	// Handle changes in the master control for Facebook sources
	$scope.toggleAllFacebook = function() {
		$scope.sources.facebook.enabled = ! $scope.sources.facebook.enabled;
		$scope.sources.facebook.posts = $scope.sources.facebook.enabled;
		$scope.sources.facebook.pages = $scope.sources.facebook.enabled;
		$scope.sources.facebook.postsInPages = $scope.sources.facebook.enabled;
	};

	// Generate query term variants
	$scope.getAltQueries = function() {
		if($scope.search.query)
			return getAlternateSearchTerms($scope.search.query);
		else
			return null;
	};

	// Returns a list of field names in the Relevant Field Map for display purpose
	$scope.getRelevantFieldNames = function() {
		var config = window.apiExplorerGlobals.config;

		if(config && config.search) {
			var relevantFieldMap = config.search.relevantFieldMap;

			return getFields(relevantFieldMap, false, true);

		} else
			return null;
	};

	// Perform a search query
	$scope.performSearch = function() {
		// Mark the status as in progress
		stateTracker.setInProgress($scope.search.state);

		// Update the title to reflect the status
		$(document).ready(function() {
			$("title").html("Searching... | API Explorer");
		});

		// Record this search endeavour in history!
		var historyRecord = angular.copy($scope.search);
		historyRecord.sources = angular.copy($scope.sources);

		// Give it a unique ID
		historyRecord.id = $scope.history.length; // unique id to refer to the current search, track its progress etc.

		// Track the progress
		historyRecord.state = stateTracker.startTracker(stateTracker.once);
		historyRecord.state.progress = 0;
		stateTracker.setInProgress(historyRecord.state);

		// Officially add to history
		$scope.history.unshift(historyRecord);

		// Prepare a list of sources suitable for the server
		var sources = [];
		if($scope.sources.twitter.enabled) {
			sources.push("twitter");
			sources.push("twitter_recent");
		}
		if($scope.sources.facebook.enabled)
			sources.push("facebook");
		if($scope.sources.facebook.posts)
			sources.push("facebook_publicPosts");
		if($scope.sources.facebook.pages)
			sources.push("facebook_pages");
		if($scope.sources.facebook.postsInPages)
			sources.push("facebook_postsInPages");

		// Other params for this task
		var params = {
			task: "fullSearch"
			, accessToken: window.apiExplorerGlobals.accessToken
			, count_facebook: $scope.sources.facebook.count
			, count_twitter: $scope.sources.twitter.count
			, scope: sources
			, queryID: historyRecord.id
			, queries: ($scope.search.withVariants ? $scope.getAltQueries() : [$scope.search.query])
			, relevantOnly: $scope.search.onlyRelevant
		};

		// Issue the request
		doAjax(params, function(combinedResponse) {
			// On completion of the search
			try {
				if (typeof combinedResponse == "string") {
					combinedResponse = JSON.parse(combinedResponse);
				}

				// Update the history record with the response, if the record is available
				if(historyRecord && (typeof historyRecord !== "undefined")) {

					// Record the response and the time it finished
					historyRecord.response = combinedResponse;
					historyRecord.time = moment().valueOf(); // record the current timestamp

					// Update the state
					historyRecord.state.progress = 100; // extend the progress to 100%
					stateTracker.setCompleted(historyRecord.state); // mark as compeleted
					$scope.$apply();

					// Update the title to reflect the status
					$(document).ready(function() {
						$("title").html("&#10004; Search Complete | API Explorer");
					});

					// Since it is tied to the global variable, it is updated automatically
					watchGlobals.trigger(); // Trigger angular to read the updates
				}

			} catch(e) {
				// If the parsing failed due to bad/null response...
				if(historyRecord && (typeof historyRecord !== "undefined")) {
					stateTracker.setFailed(historyRecord.state); // ...mark as failed
					$scope.$apply();

					// Update the title to reflect the status
					$(document).ready(function() {
						$("title").html("&#10005; Search Failed | API Explorer");
					});
				}
			}
		}, function() {
			// Nothing else to do on completion
		}, function() {
			// On error, mark as failed.
			stateTracker.setFailed(historyRecord.state); // ...mark as failed
			$scope.$apply();

			// Update the title to reflect the status
			$(document).ready(function() {
				$("title").html("&#10005; Search Failed | API Explorer");
			});
		});

		// Periodically track the progress
		var updateProgress = function(queryID) {
			// Continue if this record hasn't been deleted and the search is still in progress
			var inProgress = historyRecord && (typeof historyRecord !== "undefined") && stateTracker.isInProgress(historyRecord.state);

			if(inProgress) {
				getAjax(
					"progress/progress" + historyRecord.id
					, function(progress) {
						// On successful retrieval, report progress
						if(typeof progress === "string")
							progress = JSON.parse(progress);

						var totalSearches = progress.total;
						var currentSearch = progress.completed;

						var completionPercentage = (currentSearch * 100 / totalSearches);
						if(isNaN(completionPercentage))
							completionPercentage = 0;

						// Update the search progress if the record is still available
						if(historyRecord && (typeof historyRecord !== "undefined")) {
							historyRecord.state.progress = completionPercentage;
							$scope.$apply();
						}
					}
					, function() {
						// On completion, regardless of retrieval, ask for another update
						// This is because the progress tracking file may not yet be available
						if(inProgress) {
							$timeout(function() {
								updateProgress();
							}
							// Waiting time between requests
							// Logarithmically rises with the number of requests expected
							, 1000 * (0.1 + parseInt(Math.log(historyRecord.sources.facebook.count + historyRecord.sources.twitter.count), 10)));
						}
					});
			}
		};
		updateProgress();

	};

	// Clear records from search history
	$scope.clearHistory = function(record) {
		// Delete a single record
		if(record)
			delete $scope.history[$scope.history.indexOf(record)];

		// Or delete the whole history
		else
			$scope.history = [];

		// Either way, the updates must be refected globally
		window.apiExplorerGlobals.searchHistory = $scope.history; // tie up by reference
	};
}

// Controller for the charts section
function ChartController($scope, stateTracker) {
	// Tracker for results available outside
	$scope.areResultsAvailable = false;

	// Collection of search results
	$scope.results = {};

	// Extract field names from results
	$scope.resultFields = [];

	// Selected chart options
	$scope.xAxisLabel = "";
	$scope.yAxisLabel = "";

	// Chart descriptors ready to use with Highcharts
	$scope.charts = {};

	$scope.charts.labels = [
		"timelineChart"
		, "countComparisonChart"
		, "crossComparisonChart"
		, "distributionChart"
	]; // used as ID the container elements for example

	$scope.charts.names = {
		"timelineChart": "Time Series"
		, "countComparisonChart": "Basic Comparison"
		, "crossComparisonChart": "Cross-field Comparison"
		, "distributionChart": "Distribution Plots"
	}; // used as chart titles for example

	// Chart descriptors
	$scope.charts.timelineChart = {};
	$scope.charts.countComparisonChart = "";
	$scope.charts.crossComparisonChart = "";
	$scope.charts.distributionChart = []; // one descriptor per search record

	// Track the progress of chart building
	$scope.stateTracker = stateTracker;
	$scope.charts.state = stateTracker.startTracker(stateTracker.once);

	// Any warnings on the quality of the data
	$scope.charts.warnings = [];

	// Watch any relevant variables from outside angular
	var unbind = watchGlobals.watch(function(updatedGlobals) {

		// Check if we have an updated search history
		if(updatedGlobals.searchHistory.length > 0)
			$scope.areResultsAvailable = true;

		$scope.$apply();
	});

	// Unbind the listener when the scope is destroyed
	$scope.$on('$destroy', unbind);

	// End-to-end solution for construction charts
	$scope.buildCharts = function(searchHistory){
		// Mark state is in progress
		stateTracker.setInProgress($scope.charts.state);

		// First, check for any potential problems
		$scope.checkForWarnings(searchHistory);

		// Extract the search results
		var extractedResults = [];
		angular.forEach(
			searchHistory
			, function(historyRecord, index) {
				if(historyRecord.response)
					this[historyRecord.query] = historyRecord.response;
			}
			, extractedResults);

		// Overwrite any previous result collection with the latest one
		$scope.results = extractedResults;
		$scope.resultFields = getFields(extractedResults, true, false);
		// Select good defaults
		if(!$scope.xAxisLabel || $scope.xAxisLabel === "")
			$scope.xAxisLabel = $scope.resultFields[0];
		if(!$scope.yAxisLabel || $scope.yAxisLabel === "")
			$scope.yAxisLabel = $scope.resultFields[0];

		// Prepare the charts
		$scope.setChartDescriptors();

		// Draw or re-draw charts
		$scope.drawCharts();

		// Mark progress as complete
		stateTracker.setCompleted($scope.charts.state);
	};

	// Manual reload using the global history records
	$scope.reloadCharts = function() {
		if(window.apiExplorerGlobals.searchHistory && window.apiExplorerGlobals.searchHistory.length > 0)
			$scope.buildCharts(window.apiExplorerGlobals.searchHistory);
		else
			$scope.areResultsAvailable = false;
	};

	// Do we have any warnings to show?
	$scope.hasWarnings = function() {
		return angular.isArray($scope.charts.warnings) && $scope.charts.warnings.length > 0;
	};

	// Check the data for any potential problems
	$scope.checkForWarnings = function(searchHistory) {
		$scope.charts.warnings = checkSearchWarnings(
			searchHistory
			, {
				"duplicate-queries": "Duplicate queries:"
					+ " you have more than one search record with the same query."
					+ " Charts will be plotted for only one of those records."
				, "mixed-categories": "Mismatched result fields:"
					+ " some of your search results are grouped by relevant fields, some are not."
					+ " The plots will be confused and inconclusive!"
			}
		);
	};

	// Construct descriptors ready to use with Highcharts
	$scope.setChartDescriptors = function() {
		if($scope.results)
			$scope.charts.timelineChart = describeChart_time(
				prepareData_time(
					$scope.results
				)
			);

		if($scope.results, $scope.xAxisLabel, $scope.yAxisLabel)
			$scope.charts.countComparisonChart = describeChart_countComparison(
				prepareData_countComparison(
					$scope.results
					, $scope.xAxisLabel
					, $scope.yAxisLabel
				)
			);

		if($scope.results, $scope.xAxisLabel, $scope.yAxisLabel)
			$scope.charts.crossComparisonChart = describeChart_crossComparison(
				prepareData_crossComparison(
					$scope.results
					, $scope.xAxisLabel
					, $scope.yAxisLabel
				)
			);

		if($scope.results, $scope.xAxisLabel) {
			var chartDataList = prepareData_distribution(
					$scope.results
					, $scope.xAxisLabel
			);

			$scope.charts.distributionChart = [];
			for(var index in chartDataList)
				$scope.charts.distributionChart.push(describeChart_distribution(chartDataList[index]));
		}
	};

	// Draw or re-draw charts wherever descriptors are available
	$scope.drawCharts = function() {
		$(document).ready(function() {
			angular.forEach($scope.charts.labels, function(label, index){
				drawChart($("#" + label), $scope.charts[label]);
			});
		});
	};
}

// Controller for the tabular results section
function TableController($scope, $filter, $q, $timeout, stateTracker, ngTableParams) {
	// Collection of search results
	$scope.results = [];

	// Table data
	$scope.table = {};
	$scope.tableParams = null;

	// Any warnings on the quality of the data
	$scope.table.warnings = [];

	// Construct the table replete with sorting,
	// filtering and pagination
	$scope.initTable = function() {
		$scope.tableParams = new ngTableParams({
			page: 1 // show first page
			, count: 10 // count per page
			, sorting: { // initial sorting
				query: "asc"
				, field: "asc"
				, count: "desc"
			}
		}
		, {
			total: $scope.results.length // length of data
			, getData: function($defer, params) {
				// First, filter the data
				var filteredData = params.filter()
					? $filter('filter')($scope.results, params.filter())
					: $scope.results;

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

	// Do we have any warnings to show?
	$scope.hasWarnings = function() {
		return angular.isArray($scope.table.warnings) && $scope.table.warnings.length > 0;
	};

	// Check the data for any potential problems
	$scope.checkForWarnings = function(searchHistory) {
		$scope.table.warnings = checkSearchWarnings(
			searchHistory
			, {
				"duplicate-queries": "Duplicate queries:"
					+ " you have more than one search record with the same query."
					+ " There may be duplicate rows in this table."
			}
		);
	};

	// Prepare a list of queries to be made available as table filter
	$scope.getQueries = function() {
		var queries = [];
		var queries_filterReady = [];

		angular.forEach(window.apiExplorerGlobals.searchHistory
			, function(historyRecord, index) {
				var query = historyRecord.query;
				if(queries.indexOf(query) < 0) {
					queries.push(query);
				}
		});

		return queries;
	};

	// Prepare a list of field names to be made available as table filter
	$scope.getFields = function() {
		var fields = [];
		var fields_filterReady = [];

		angular.forEach(window.apiExplorerGlobals.searchHistory
			, function(historyRecord, index) {
				var response = historyRecord.response;
				angular.extend(fields, getFields(response, false, false));
		});

		return fields;
	};

	// Bind the results with the table
	// Automatically populate the table with the latest results
	$scope.$watch("results", function () {
		if(!$scope.tableParams)
			$scope.initTable(); // create one the first time
		else
			$scope.tableParams.reload(); // reload afterwards
	});

	// Track the progress of table building
	$scope.stateTracker = stateTracker;
	$scope.table.state = stateTracker.startTracker(stateTracker.once);
	$scope.table.zoomState = stateTracker.startTracker(stateTracker.once);

	// Watch any relevant variables from outside angular
	var unbind = watchGlobals.watch(function(updatedGlobals) {

		// Check if we have an updated search history
		if(updatedGlobals.searchHistory.length > 0)
			$scope.buildTable(updatedGlobals.searchHistory);

		$scope.$apply();
	});

	// Unbind the listener when the scope is destroyed
	$scope.$on('$destroy', unbind);

	// End-to-end solution for construction the table
	$scope.buildTable = function(searchHistory) {

		// Mark state is in progress
		stateTracker.setInProgress($scope.table.state);

		// Check for any potential problems
		$scope.checkForWarnings(searchHistory);

		// Combine the search results
		var combinedResults = flattenSearchRecords(searchHistory);

		// Overwrite any previous result collection with the latest one
		$scope.results = combinedResults;
		$scope.resultFields = getFields(combinedResults, true, false);

		// Mark progress as complete
		stateTracker.setCompleted($scope.table.state);
	};

	// Manual reload using the global history records
	$scope.reloadTable = function() {
		$scope.buildTable(window.apiExplorerGlobals.searchHistory);
	};

	// Zoom into a selected field-entry row on the table
	// to see all the individual message
	$scope.selectedMessages = [];
	$scope.selectedQuery = null;
	$scope.zoomInto = function(messageQuery, messageIDList) {

		// Mark state is in progress
		stateTracker.setInProgress($scope.table.zoomState);

		// Flush previously selected messages
		$scope.selectedMessages = [];
		$scope.selectedQuery = messageQuery;

		$timeout(
			function() {
				$scope.reconstructPosts(messageQuery, messageIDList);
			}
			, 1000
		);
	};

	// Construct full, original posts for the given message IDs
	$scope.reconstructPosts = function(messageQuery, messageIDList) {
		// Iterate over each of the message IDs selected
		angular.forEach(
			messageIDList
			, function(messageID, index) {

				// Extract the full message content from the search results
				$scope.selectedMessages.push(
					extractMessageByID(
						messageQuery
						, messageID
						, window.apiExplorerGlobals.searchHistory
					)
				);
		});

		// Mark progress as complete
		stateTracker.setCompleted($scope.table.zoomState);
	};

	// Export the whole set of search results into CSV
	$scope.fullCSV = "data:text/csv;charset=UTF-8,";
	$scope.generateCSV = function() {
		var csv = "";
		var delimiter = ",";
		var eol = "\n";
		var characterLimitPerColumn = 10000;

		function stringify(text) {
			return '"'
				+ text.replace(/^\s\s*/, '').replace(/\s*\s$/, '').replace(/\s+/g,' ').replace(/"/g,'""')
				+ '"';
		}

		// Headline
		var headline = "";
		angular.forEach(["Query", "Field", "Entry", "Count"], function(value, key) {
			headline += stringify("" + value) + delimiter;
		});

		headline = headline.slice(0, headline.length - 1); //remove last delimiter

		csv += headline + eol;

		angular.forEach($scope.results, function(result, index){
			var line = "";

			// Format: {query, field, entry, count}
			angular.forEach(["query", "field", "entry", "count"], function(value, key) {
				var trimmedValue = ("" + result[value]).slice(0, characterLimitPerColumn); // can't have too long a cell

				line += stringify(trimmedValue) + delimiter;
			});

			line = line.slice(0, line.length - 1); //remove last delimiter

			csv += line + eol;
		});

		$scope.fullCSV = "data:text/csv;charset=UTF-8,\uFEFF" + encodeURIComponent(csv);
	};
}

// Controller for the performance section
function PerformanceController($scope, stateTracker) {
	// Reference to the search history
	$scope.searchHistory = {};

	// Track the progress of table building
	$scope.stateTracker = stateTracker;
	$scope.performanceState = stateTracker.startTracker(stateTracker.once);

	// Watch any relevant variables from outside angular
	var unbind = watchGlobals.watch(function(updatedGlobals) {

		// Check if we have an updated search history
		if(updatedGlobals.searchHistory)
			$scope.calculatePerformance(updatedGlobals.searchHistory);

		$scope.$apply();
	});

	// Unbind the listener when the scope is destroyed
	$scope.$on('$destroy', unbind);

	// Update search history to include performance measurements
	// including term and document frequencies
	$scope.calculatePerformance = function(searchHistory) {
		// Mark state is in progress
		stateTracker.setInProgress($scope.performanceState);

		$scope.searchHistory = tallyCounts(searchHistory);

		// Mark progress as complete
		stateTracker.setCompleted($scope.performanceState);
	};

	// Calculate the performance scores using the global search records
	$scope.reloadPerformance = function() {
		$scope.calculatePerformance(window.apiExplorerGlobals.searchHistory);
	};
}
