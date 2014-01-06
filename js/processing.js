/* global angular, moment */

/////////////////////////////////
// Search results manipulation //
/////////////////////////////////

// Extract a list of unique field names from a field map.
// Example, the relevantFieldMap or the actual search results.
// Fields are obviously in the keys, but if they are in the values,
// specify byValue = true (example in the relevantFieldMap).
// If this is a list of field maps, specify hasMultiple = true
// so fields from all children will be considered in union.
function getFields(fieldMaps, hasMultiple, byValue) {
	var fieldMap;
	if(!hasMultiple) {
		fieldMap = fieldMaps;
		fieldMaps = [];
		fieldMaps.push(fieldMap);
	}

	var fieldNames = [];

	for(var index in fieldMaps) {
		fieldMap = fieldMaps[index];

		for(var key in fieldMap) {
			var fieldName = key;
			if(byValue)
				fieldName = fieldMap[key];

			if(fieldName && fieldName !== "" && fieldNames.indexOf(fieldName) < 0)
				fieldNames.push(fieldName);
		}
	}

	return fieldNames.sort();
}

// Check the data for any potential problems
// Supply an array of required warning types and reportable error messages
// in reportableWarnings. Example, {"duplicate-queries": "Duplicate queries have been detected."}
// Types available:
// 		duplicate-queries: Test for multiple search results for the same query,
// 							albeit with different settings.
// 		mixed-categories: Test whether some results are grouped into relevant
// 							categories while some are not.
function checkSearchWarnings(searchHistory, reportableWarnings) {
	var warnings = [];

	if(searchHistory) {
		var index, historyRecord;

		// 1. There should be only one result per exact query terms
		if(reportableWarnings && reportableWarnings["duplicate-queries"]) {

			var extractedQueries = []; // tracking list for queries - to spot any duplicates
			for(index in searchHistory) {
				// Read the query terms
				historyRecord = searchHistory[index];
				var query = historyRecord.query;

				// Did we see this query previously?
				if(extractedQueries.indexOf(query) >= 0) {
					// Yes, duplicate found! Issue warning
					warnings.push(reportableWarnings["duplicate-queries"]);

					break; // no need to continue;

				} else {
					// No, add it to the tracking list
					extractedQueries.push(query);
				}
			}
		}

		// 2. Searches must have the same type of result fields
		if(reportableWarnings && reportableWarnings["mixed-categories"]) {

			var isGroupedByRelevant = null; // tracker for the 'only relevant' setting
			for(index in searchHistory) {
				// Read the setting
				historyRecord = searchHistory[index];
				var usingRelevant = historyRecord.onlyRelevant;

				// Do we have any track of what this setting ought to be?
				if(isGroupedByRelevant !== null) {
					// Yes, does the newly extract one match the tracked one?
					if(usingRelevant != isGroupedByRelevant) {
						// No, mismatch found! Issue warning
						warnings.push(reportableWarnings["mixed-categories"]);

					} // Else yes, continue then.

				} else {
					// No, add it to our tracker to begin tracking
					isGroupedByRelevant = usingRelevant;
				}
			}
		}

	}

	return warnings;
}

// Combine all results into one array of objects:
// [ { query, field, entry, count, ids } ]
function flattenSearchRecords(searchHistory) {
	var combinedResults = [];

	angular.forEach(
		searchHistory
		, function(historyRecord, index) {

			// Open the record
			if(historyRecord.response) {
				var response = historyRecord.response;

				// Read each field
				for(var field in response) {
					var entries = response[field];

					// Each field has multiple entries.
					// Read each entry
					for(var entry in entries) {
						var entryDetails = entries[entry];

						// Each entry has a count and a list of IDs
						// Add them all!
						this.push({
							query: historyRecord.query
							, field: field
							, entry: filterTime(entry, field)
							, count: entryDetails.count
							, ids: entryDetails.id
						});
					}
				}
			}
		}
		, combinedResults
	);

	return combinedResults;
}

// For any given query and id, extract all the returned fields
// in order to reconstruct the full, original message
function extractMessageByID(query, id, searchHistory) {
	var extractedFields = {};

	angular.forEach(
		searchHistory
		, function(historyRecord, index) {

			// Open the record if it pertains to our desired query
			if(historyRecord.query === query && historyRecord.response) {
				var response = historyRecord.response;

				// Read each field
				for(var field in response) {
					var entries = response[field];

					// Each field has multiple entries.
					// Read each entry
					for(var entry in entries) {
						var entryDetails = entries[entry];

						// Each entry has a count and a list of IDs
						// Check if the IDs contain our desired ID
						if($.inArray(id, entryDetails.id) >= 0) {

							// Add it!
							extractedFields[field] = entry;
						}
					}
				}
			}
	});

	return extractedFields;
}

// Calculates the total number of posts returned in each search,
// and the number of those which had the query term included.
// Adds the following fields to each search for easy access:
// 		stats.documentFrequency: number of results where the term appears at least once
// 		stats.termFrequency: total number of times the term appears in the search results
// 		stats.sdocumentCount: total number of results in the search record
function tallyCounts(searchHistory) {
	var talliedSearchHistory = [];

	angular.forEach(
		searchHistory
		, function(historyRecord, index) {

			// Consider each record with any results
			if(historyRecord.response) {
				var query = historyRecord.query;
				var response = historyRecord.response;

				// Start the count
				var count_postsWithMatch = 0; // count of posts with any matches
				var termFrequency = 0; // total number of times the term appears in all results
				var normalisedTermFrequency = 0; // TF divided by the length of the entry

				// List of ids - which helps find the exact total count
				var ids = [];
				var idsWithMatches = [];

				// Read each field
				for(var field in response) {
					var entries = response[field];

					// Each field has multiple entries.
					// Read each entry
					for(var entry in entries) {

						// First, count how many times the search term appears
						var matchCount = highlight(entry, query, true); // only count to be returned
						termFrequency += matchCount; // note the new matches in the total term frequency
						normalisedTermFrequency += (matchCount / entry.split(" ").length);

						// Was any match found?
						var matchFound = (matchCount > 0);

						var entryDetails = entries[entry];

						// Each entry has a count and a list of IDs
						// Note the IDs here, and note whether any match was found
						for(var idIndex in entryDetails.id) {
							var id = entryDetails.id[idIndex];

							if(ids.indexOf(id) < 0)
								ids.push(id);

							if(matchFound && idsWithMatches.indexOf(id) < 0)
								idsWithMatches.push(id);
						}
					}
				}

				// Add the tallies to the new search history
				var newRecord = angular.copy(historyRecord);
				newRecord.stats = {};
				newRecord.stats.documentFrequency = idsWithMatches.length;
				newRecord.stats.documentCount = ids.length;
				newRecord.stats.termFrequency = termFrequency;
				newRecord.stats.normalisedTermFrequency = normalisedTermFrequency;
				talliedSearchHistory.push(newRecord);
			}
	});

	return talliedSearchHistory;
}

//////////////////////
// Search utilities //
//////////////////////

// Query normalization
function normalize(query) {
	// Case folding
	query = query.toLowerCase();

	// Removing special chars
	var specials = /[.*+?|()\[\]{}\\$^]/g; // .*+?|()[]{}\$^
	query = query.replace(specials, "\\$&");
	query = query.trim();

	return query;
}

// Completely remove all non-alphanumeric characters
function marshal(query) {
	query = normalize(query);
	return query.replace(/\W/g, "");
}

// Produces a list of variations of the query (eg. without spaces, with a hash, etc.)
function getAlternateSearchTerms(query) {
	// Normalize the query
	query = normalize(query.trim());

	// Remove any hash tags
	query = query.replace(/^#/, "");

	// Create alternate versions (interchanging spaces with hyphens and with nulls)
	var altQueries = [];
	var query_spaced = query.replace(/-/g, " ");
	var query_hyphened = query.replace(/\s/g, "-");
	var query_gapless = query.replace(/\W/g, "");
	var query_hashed = "#" + query_gapless;
	if($.inArray(query_hashed, altQueries) < 0) altQueries.push(query_hashed);
	if($.inArray(query_gapless, altQueries) < 0) altQueries.push(query_gapless);
	if($.inArray(query, altQueries) < 0) altQueries.push(query);
	if($.inArray(query_spaced, altQueries) < 0) altQueries.push(query_spaced);
	if($.inArray(query_hyphened, altQueries) < 0) altQueries.push(query_hyphened);

	// separateWords = query.split(/\s+/); // add each words separately too
	// for(var i = 0, len = separateWords.length; i < len; i++)
	// 	if($.inArray(separateWords[i], altQueries) < 0)
	// 		altQueries.push(separateWords[i]);

	return altQueries;
}


////////////////////////////
// Filters and highlights //
////////////////////////////

// Custom filters to, example, display time values nicely
function filterTime(entry, field) {
	if (field.match(/time|created|date/gi) && !field.match(/zone/gi)) {
		// If this is a time field, convert to a human-friendly format
		var day = moment(entry);
		entry = day.format("llll") + " (" + day.fromNow() + ")";
	}
	else if (field.match(/unix/gi)) {
		// If this is a time field, convert to a human-friendly format
		var day = moment.unix(entry);
		entry = day.format("llll") + " (" + day.fromNow() + ")";
	}

	return entry;
}

// Highlight search terms in the text for easy identification
// Returns highlighted text, or count of matches if onlyCount = true
// The count can be useful for testing whether there was any match after all
function highlight(haystack, needle, onlyCount) {
	// Get all possible alternates if requested
	var needles = getAlternateSearchTerms(needle);
	var matches = 0; // count of matches

	// Perform the highlighting!
	for (var index in needles) {
		var regex = new RegExp("(" + needles[index] + ")", "gi");
		haystack = haystack.replace(regex, function(match) {
			matches++;
			return "<span class='label label-primary'>" + match + "</span>"; // return the replacement
		});
	}

	return onlyCount ? matches : haystack;
}
