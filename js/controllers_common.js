/* jshint unused: false */
/* global angular, watchGlobals, themify, doAjax, getAjax, getAlternateSearchTerms
, getFields, moment, tallyCounts, checkSearchWarnings, describeChart_time, describeChart_distribution
, describeChart_countComparison, describeChart_crossComparison, prepareData_time, prepareData_distribution
, prepareData_countComparison, prepareData_crossComparison, drawChart
, flattenSearchRecords, extractMessageByID */

////////////////////////////////////////
// Controller for the main navigation //
////////////////////////////////////////
function NavController($scope, $cookies) {
	// Content pages
	// $scope.pageConnect = $cookies.activePage ? ($cookies.activePage === "pageConnect" ? "active" : "") : "active";
	$scope.pageSearch = $cookies.activePage ? ($cookies.activePage === "pageSearch" ? "active" : "") : "active";
	// $scope.pageSearch = $cookies.activePage === "pageSearch" ? "active" : "";
	$scope.pageAnalyse = $cookies.activePage === "pageAnalyse" ? "active" : "";
	$scope.pageConnect = $cookies.activePage === "pageConnect" ? "active" : "";

	// Sections in the analysis page
	$scope.sectionTable = $cookies.activeSection ? ($cookies.activeSection === "sectionTable" ? "active" : "") : "active";
	$scope.sectionCharts = $cookies.activeSection === "sectionCharts" ? "active" : "";
	$scope.sectionPerformance = $cookies.activeSection === "sectionPerformance" ? "active" : "";

	// Content pages – Steam Explorer
	// $scope.pageConnect_steam = $cookies.activePage_steam ? ($cookies.activePage_steam === "pageConnect_steam" ? "active" : "") : "active";
	$scope.pageGames = $cookies.activePage_steam ? ($cookies.activePage_steam === "pageGames" ? "active" : "") : "active";
	// $scope.pageGames = $cookies.activePage_steam === "pageGames" ? "active" : "";
	$scope.pageUsers = $cookies.activePage_steam === "pageUsers" ? "active" : "";
	$scope.pageConnect_steam = $cookies.activePage_steam === "pageConnect_steam" ? "active" : "";

	// Sections in the games page – Steam Explorer
	$scope.sectionNews = $cookies.activeSection_steam ? ($cookies.activeSection_steam === "sectionNews" ? "active" : "") : "active";
	$scope.sectionAchievements = $cookies.activeSection_steam === "sectionAchievements" ? "active" : "";
	$scope.sectionUserStats = $cookies.activeSection_steam === "sectionUserStats" ? "active" : "";

	// Simple check to see if the app has loaded
	$scope.hasAppLoaded = false;
	// If we have reached here, obviously Angular is running
	// Check if jQuery and Highcharts are available
	$(document).ready(function() {
		$scope.hasAppLoaded = (typeof $(document).highcharts == "function");
	});

	// Record the active page so reloads continue from the last open page
	$scope.saveCurrentPage = function(activePage, explorer) {
		if(!explorer)
			$cookies.activePage = activePage;
		else
			$cookies["activePage_" + explorer] = activePage;
	};

	// Record the active section so reloads continue from the last open section in the page
	$scope.saveCurrentSection = function(activeSection, explorer) {
		if(!explorer)
			$cookies.activeSection = activeSection;
		else
			$cookies["activeSection_" + explorer] = activeSection;
	};

	// Themes for the whole application
	$scope.currentTheme = "default";
	$scope.themes = {};
	$scope.themes.default = "//netdna.bootstrapcdn.com/bootstrap/3.0.0/css/bootstrap.min.css";
	$scope.themes.amelia = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/amelia/bootstrap.min.css";
	$scope.themes.cerulean = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/cerulean/bootstrap.min.css";
	$scope.themes.cosmo = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/cosmo/bootstrap.min.css";
	$scope.themes.cyborg = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/cyborg/bootstrap.min.css";
	$scope.themes.flatly = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/flatly/bootstrap.min.css";
	$scope.themes.journal = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/journal/bootstrap.min.css";
	$scope.themes.readable = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/readable/bootstrap.min.css";
	$scope.themes.simplex = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/simplex/bootstrap.min.css";
	$scope.themes.slate = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/slate/bootstrap.min.css";
	$scope.themes.spacelab = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/spacelab/bootstrap.min.css";
	$scope.themes.united = "//netdna.bootstrapcdn.com/bootswatch/3.0.0/united/bootstrap.min.css";

	// Get the current theme
	$scope.getCurrentTheme = function() {
		var savedTheme = $cookies.theme;
		return savedTheme ? savedTheme : "default";
	};

	// Switch to the specified theme
	$scope.switchTheme = function(theme) {
		$("#theme-css").attr("href", $scope.themes[theme]);
		$scope.currentTheme = theme;

		// Make any theme-independent elements look themed
		setTimeout(themify, 1500);

		// Save it permanently for when the user returns to the site later
		$cookies.theme = theme;
	};

	// Switch to the saved theme on load
	$scope.switchTheme($scope.getCurrentTheme());
}
