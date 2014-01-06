/* jshint unused: false */
/* global angular, filterTime, highlight, FB */

//////////////////////////////////////////
// Global data & configuration settings //
//////////////////////////////////////////

// Global data holder
window.apiExplorerGlobals = {
	"uid": null
	, "accessToken": null
	, "config": null
};

// Allow our Angular app to watch for changes on this global variable.
// Uses the Push/Subscribe design pattern.
var watchGlobals = (function() {
	var watches = {};

	return {
		// Subscribe to updates
		watch: function(callback) {
			var id = Math.random().toString();
			watches[id] = callback;

			// Return a function that removes the listener
			return function() {
				watches[id] = null;
				delete watches[id];
			};
		}

		// Push an update
		, trigger: function() {
			for (var k in watches) {
				watches[k](window.apiExplorerGlobals);
			}
		}
	};
})();

// Initialize our application module
var app = angular.module('apiExplorer'
	, [
		'ngCookies'
		, 'ngSanitize'
		, 'ngTable'
		, 'ngTableExport'
	]
); // add required modules

// Add filters
app.filter("prettyTime", function() {
	return function(entry, field) {
		return filterTime(entry, field);
	};
});
app.filter("highlightQuery", function() {
	return function(entry, query) {
		return highlight(entry, query);
	};
});
app.filter("highlightGameType", function() {
	return function(type) {
		switch(type) {
			case "Placeholder / Unused":
				return "label-danger";
			case "Unannounced / Alpha":
				return "label-warning";
			case "Trailer / Pre-Order":
				return "label-default";
			case "Game":
				return "label-success";
			case "Beta":
				return "label-info";
			case "Demo":
				return "label-primary";
		}
	};
});
app.filter("highlightStatsType", function() {
	return function(type) {
		switch(type) {
			case "Achievement":
				return "label-success";
			case "Statistics":
				return "label-warning";
		}
	};
});
app.filter("playerState", function() {
	return function(state) {
		switch(state) {
			case "0":
				return "Offline / Private";
			case "1":
				return "Online";
			case "2":
				return "Busy";
			case "3":
				return "Away";
			case "4":
				return "Snooze";
			case "5":
				return "Looking to Trade";
			case "6":
				return "Looking to Play";
			default:
				return "Status Unknown";
		}
	};
});


//////////////////
// Ajax handlers //
//////////////////

// For POST calls, which must always pass through our server
function doAjax(params, callback_success, callback_complete, callback_error) {
	$.ajax({
		url: "controller.php"
		, method: "post"
		, data: params
		, success: callback_success
		, complete: callback_complete
		, error: callback_error
	});
}

// For GET calls, which are exclusively used to get a raw file
function getAjax(url, callback_success, callback_complete, callback_error) {
	$.ajax({
		url: url
		, method: "get"
		, success: callback_success
		, complete: callback_complete
		, error: callback_error
	});
}

/////////////////////
// Facebook JS SDK //
/////////////////////

// Load the SDK asynchronously, but on demand
function connectToFacebook() {
	// Load the SDK files
	(function(d, s, id) {
		var js, fjs = d.getElementsByTagName(s)[0];
		if (d.getElementById(id)) {return;}
		js = d.createElement(s); js.id = id;
		js.src = "//connect.facebook.net/en_US/all.js";
		fjs.parentNode.insertBefore(js, fjs);
	}(document, 'script', 'facebook-jssdk'));

	// Initialise the API
	window.fbAsyncInit = function() {
		// Fetch the config variables
		var config = window.apiExplorerGlobals.config;
		// Abort if none found
		if(!config || !config.facebook)
			return;

		// Get the app ID
		var appId = config.facebook.appId;
		// Don't attempt this until we have the app ID
		if(!appId)
			return;

		FB.init({
			appId: appId, // App ID
			channelUrl: "channel.html", // Channel File
			status: true, // check login status
			cookie: true, // enable cookies to allow the server to access the session
			xfbml: true // parse XFBML
		});

		// If the user is logged in,
		// auth the user in
		FB.getLoginStatus(handleAuth);

		// Process the auth response
		function handleAuth(response) {
			if (response.status === "connected") {
				// User has authed the app. Note the supplied details
				window.apiExplorerGlobals.uid = response.authResponse.userID;
				window.apiExplorerGlobals.accessToken = response.authResponse.accessToken;

				// Trigger angular updates
				watchGlobals.trigger();

			} else {
				// User hasn't authed, or isn't logged in
				// Try again
				requestAuth();
			}
		}

		// Explicitly ask the user to log in
		// and auth themselves
		function requestAuth() {
			FB.login(handleAuth);
		}
	};
}

/////////////////////
// Common services //
/////////////////////

// Make any theme-independent elements look themed
function themify() {

	// Colour the on-off switch appropriately
	$(document).ready(function() {

		// Make sure there's at least one element containing the styles we need
		$("body").append($("<button class='btn btn-success hidden' id='themify-sample1'></button>"));

		// Get the styles of interest
		var primaryThemeColour = $(".btn-success").css("background-color");

		// Delete the sample elements
		$("#themify-sample1").remove();

		// Apply the extracted styles rampantly
		$("body").append($("<style>.onoffswitch-inner:before { background-color: " + primaryThemeColour + "; }</style>"));
	});
}

// Service to control & manipulate the states of any component (eg. interactive buttons).
// States offered: inactive -> in-progress -> completed or failed
// (using "failed" state is optional).
// Usage:
// 	1. Initialise a state tracker using startTracker(type). A state object is returned that is
// 		used for all subsequent functions.
// 		Types available:
// 			1. serial (default): reset after completion. States: inactive -> active -> completed/failed -> inactive ...
// 			2. parallel: use to allow clicking without waiting for completion. States: inactive -> active -> inactive ...
// 			3. one-time use only; do not reset after completion. States: inactive -> active -> completed/failed.
// 	2. Use functions to set state: invalidate(), setInProgress(), setCompleted(), setFailed()
// 	3. Use functions to check for state: isInactive(), isInProgress(), isComplete(), isFailed()
// 	4. Map a list of values automatically based on state:
// 			map(["value-for-inactive", "value-for-in-progress", "value for completed"], state)
// 		A common use-case: picking a class based on the state.
// 		For ease, some preconfigured class names are available:
// 			Bootstrap button: map("bootstrap-button", state)
// 			Bootstrap progress bar: map("bootstrap-progress-bar", state)
// 			FontAwesome icons: map("fa", state) or map("fa-loading", state) for loading-only effect
app.factory("stateTracker", function($timeout) {
	var stateTrackerTypes = {
		parallel: 10 // use to allow clicking without waiting for completion. States: inactive -> active -> inactive ...
		, serial: 11 // normal; reset after completion. States: inactive -> active -> completed/failed -> inactive ...
		, once: 12 // one-time use only; do not reset after completion. States: inactive -> active -> completed/failed.
	};

	var _states = {
		inactive: 0
		, active: 1
		, completed: 2
		, failed: 3
	};

	var _classes_bootstrap_button = [
		""
		, "state-active"
		, "btn-success state-completed"
		, "btn-danger state-failed"
	];
	var _classes_bootstrap_progress_bar = [
		""
		, "state-active"
		, "progress-bar-success state-completed"
		, "progress-bar-danger state-failed"
	];

	var _classes_fontawesome_icons = [
		"hide"
		, "fa-spinner fa-spin"
		, "fa-check"
		, "fa-times"
	];

	var _classes_fontawesome_loadingonly_icons = [
		""
		, "fa-spin"
		, ""
		, ""
	];

	function _activate(stateObject) {
		stateObject.state = _states.active;
	}

	function _markComplete(stateObject) {
		stateObject.state = _states.completed;
	}

	function _deactivate(stateObject) {
		stateObject.state = _states.inactive;
	}

	function _fail(stateObject) {
		stateObject.state = _states.failed;
	}

	function setActive(stateObject) {
		if(!angular.isDefined(stateObject)) return;
		_activate(stateObject);

		// For parallel types, revert to inactive in a while
		// i.e. the in-progress state is for show only
		if(stateObject.type === stateTrackerTypes.parallel) {
			$timeout(function() {
				_deactivate(stateObject);
			}, 2000);
		}
	}

	function setCompleted(stateObject) {
		if(!angular.isDefined(stateObject)) return;
		$timeout(function() {
			_markComplete(stateObject);

			// For serial types, revert to inactive in a while
			// i.e. only further interaction with the button
			if(stateObject.type === stateTrackerTypes.serial) {
				$timeout(function() {
					_deactivate(stateObject);
				}, 3000);
			}

		}, 750);
	}

	function setFailed(stateObject) {
		if(!angular.isDefined(stateObject)) return;
		_fail(stateObject);
	}

	function setInactive(stateObject) {
		if(!angular.isDefined(stateObject)) return;
		_deactivate(stateObject);
	}

	function isActive(stateObject) {
		if(!angular.isDefined(stateObject)) return false;
		return stateObject.state === _states.active;
	}

	function isComplete(stateObject) {
		if(!angular.isDefined(stateObject)) return false;
		return stateObject.state === _states.completed;
	}

	function isFailed(stateObject) {
		if(!angular.isDefined(stateObject)) return false;
		return stateObject.state === _states.failed;
	}

	function isInactive(stateObject) {
		if(!angular.isDefined(stateObject)) return true;
		return stateObject.state === _states.inactive;
	}

	function createReference(type) {
		var stateObject = {};

		if(type)
			stateObject.type = type;
		else
			stateObject.type = stateTrackerTypes.serial;

		_deactivate(stateObject); // initialise to inactive state
		return stateObject;
	}

	function map(options, stateObject) {
		if(!angular.isDefined(stateObject)) return "";

		if(options === "bootstrap-button")
			return _classes_bootstrap_button[stateObject.state];
		else if(options === "bootstrap-progress-bar")
			return _classes_bootstrap_progress_bar[stateObject.state];
		else if(options === "fa")
			return _classes_fontawesome_icons[stateObject.state];
		else if(options === "fa-loading")
			return _classes_fontawesome_loadingonly_icons[stateObject.state];
		else if(angular.isArray(options))
			return options[stateObject.state];
		else
			return "";
	}

	return {
		startTracker : createReference

		, isInactive: isInactive
		, isInProgress: isActive
		, isComplete: isComplete
		, isFailed: isFailed

		, setInProgress: setActive
		, setCompleted: setCompleted
		, setFailed: setFailed
		, invalidate: setInactive

		, map: map

		, parallel: stateTrackerTypes.parallel
		, serial: stateTrackerTypes.serial
		, once: stateTrackerTypes.once
	};
});
