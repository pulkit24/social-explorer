/* global moment */

//////////////////////////////////////
// Result data formatting functions //
//////////////////////////////////////

// Returns a data series of plot points
function prepareData_time(results) {
	// Prepare a list of axis labels and values
	var lines = [];
	var colorIndex = 0;

	for(var query in results) {
		var data = [];

		var result = results[query];

		// Sort all the times first, so our series line is in order
		var timeline = [];
		var time;
		for(time in result.Time)
			timeline.push(time);
		timeline = timeline.sort(function(a, b) {
			return moment(a).valueOf() - moment(b).valueOf();
		});

		// Add counts for each time point
		for(var timeIndex in timeline) {
			time = timeline[timeIndex];
			var count = (result.Time)[time].count;
			data.push([moment(time).valueOf(), count]);
		}

		var line = {
			name: query
			, _colorIndex: colorIndex++
			, data: data
		};

		lines.push(line);
	}

	// Return the chart data
	return {
		lines: lines
	};
}

// Returns a data series of plot points
function prepareData_countComparison(results, xAxisLabel) {
	var yAxisLabel = "count";

	// Prepare a list of axis labels and values
	var xAxisValues = [];
	var lines = [];

	var query, result, value;
	for(query in results) {
		result = results[query];

		for(value in result[xAxisLabel]) {
			if(xAxisValues.indexOf(value) < 0)
				xAxisValues.push(value);
		}
	}

	var colorIndex = 0;

	for(query in results) {
		var data = [];

		result = results[query];

		for(var valueIndex in xAxisValues) {
			value = xAxisValues[valueIndex];

			if(result[xAxisLabel]
				&& result[xAxisLabel][value])
				data.push(result[xAxisLabel][value][yAxisLabel]);
			else
				data.push(0);
		}

		var line = {
			name: query
			, _colorIndex: colorIndex++
			, data: data
		};

		lines.push(line);
	}

	// Return the chart data
	return {
		lines: lines
		, xAxisLabel: xAxisLabel
		, xAxisValues: xAxisValues
	};
}

// Returns a data series of plot points
function prepareData_crossComparison(results, xAxisLabel, yAxisLabel) {
	// Prepare a list of axis labels and values
	var lines = [];

	var colorIndex = 0;

	var currentXID = 0;
	var xValueIDs = []; // numeric IDs for representing the values
	var currentYID = 0;
	var yValueIDs = []; // numeric IDs for representing the values

	var value, idIndex;
	for(var query in results) {

		var result = results[query];

		var xAxisValuesByID = [];
		for(value in result[xAxisLabel]) {
			for(idIndex in result[xAxisLabel][value].id)
				xAxisValuesByID[result[xAxisLabel][value].id[idIndex]] = value;

			if(!xValueIDs[value])
				xValueIDs[value] = currentXID++;
		}

		var yAxisValuesByID = [];
		for(value in result[yAxisLabel]) {
			for(idIndex in result[yAxisLabel][value].id)
				yAxisValuesByID[result[yAxisLabel][value].id[idIndex]] = value;

			if(!yValueIDs[value])
				yValueIDs[value] = currentYID++;
		}

		var valuePairMap = [];
		var xValue, yValue;
		for(var id in xAxisValuesByID) {
			xValue = xAxisValuesByID[id];
			yValue = yAxisValuesByID[id];

			if(xValue && yValue) {
				if(!valuePairMap[xValue])
					valuePairMap[xValue] = [];

				if(!valuePairMap[xValue][yValue])
					valuePairMap[xValue][yValue] = 0;

				valuePairMap[xValue][yValue]++;
			}
		}

		var data = [];
		for(xValue in valuePairMap) {
			for(yValue in valuePairMap[xValue]) {
				var count = valuePairMap[xValue][yValue];
				data.push([xValueIDs[xValue], yValueIDs[yValue], count]);
			}
		}

		var line = {
			name: query
			, _colorIndex: colorIndex++
			, data: data
		};

		lines.push(line);
	}

	// Return the chart data
	return {
		lines: lines
		, xValueIDs: xValueIDs
		, yValueIDs: yValueIDs
		, xAxisLabel: xAxisLabel
		, yAxisLabel: yAxisLabel
	};
}

// Returns an array of data series of plot points (separate for each query)
function prepareData_distribution(results, pieChartCategory) {
	// Prepare a list of axis labels and values
	var linesPerSearch = [];

	var colorIndex = 0;

	for(var query in results) {
		var data = [];

		var result = results[query];

		for(var value in result[pieChartCategory]){
			data.push([value, result[pieChartCategory][value].count]);
		}

		var line = {
			name: query
			, _colorIndex: colorIndex++
			, type: "pie"
			, data: data
		};

		var lines = [];
		lines.push(line);

		// Add the chart data
		linesPerSearch.push({
			lines: lines
			, query: query
		});
	}

	// Return the combined data for each of the pie charts
	return linesPerSearch;
}

///////////////////////////////////////////////
// Chart descriptors for use with Highcharts //
///////////////////////////////////////////////
function describeChart_time(chartData) {
	var lines = chartData.lines;

	return lines && lines.length ? {
		chart: {
			zoomType: 'x'
			, type: "spline"
			, plotBackgroundColor: "white"
			, plotShadow: true
			, plotBorderWidth: 1
		}
		, title: {
			text: ""
		}
		, subtitle: {
				text: document.ontouchstart === undefined ?
					'Click and drag in the plot area to zoom in <br/> Click on a legend item to turns the series on/off' :
					'Pinch the chart to zoom in <br/> Tap on a legend item to turns the series on/off'
		}
		, xAxis: {
			title: {
				text: "Time"
			}
			, type: "datetime"
			, maxZoom: 2 * 24 * 60 * 60 * 1000 // 2 days
		}
		, yAxis: {
			title: {
				text: "Post Count"
			}
			, plotLines: [{
				value: 0
				, width: 1
				, color: '#808080'
			}]
		}
		, tooltip: {
			valueSuffix: ' post(s)'
			, shared: 'true'
		}
		, legend: {
			layout: 'vertical'
			, align: 'right'
			, verticalAlign: 'middle'
			, borderWidth: 0
		}
		, series: lines
	} : null;
}

function describeChart_countComparison(chartData) {
	var lines = chartData.lines;
	var xAxisLabel = chartData.xAxisLabel;
	var yAxisLabel = "count";
	var xAxisValues = chartData.xAxisValues;

	return lines && lines.length ? {
		chart: {
			plotBackgroundColor: "white"
			, plotShadow: true
			, plotBorderWidth: 1
		}
		, title: {
			text: ""
		}
		, subtitle: {
				text: document.ontouchstart === undefined ?
					'Click on a legend item to turns the series on/off' :
					'Tap on a legend item to turns the series on/off'
		}
		, xAxis: {
			title: {
				text: xAxisLabel
			}
			, categories: xAxisValues
			, labels: {
				rotation: -45
				, align: 'right'
			}
		}
		, yAxis: {
			title: {
				text: "Post Count"
			}
			, plotLines: [{
				value: 0
				, width: 1
				, color: '#808080'
			}]
		}
		, tooltip: {
			valueSuffix: ' post(s)'
			, shared: 'true'
		}
		, legend: {
			layout: 'vertical'
			, align: 'right'
			, verticalAlign: 'middle'
			, borderWidth: 0
		}
		, series: lines
	} : null;
}

function describeChart_crossComparison(chartData) {
	var lines = chartData.lines;
	var xValueIDs = chartData.xValueIDs;
	var yValueIDs = chartData.yValueIDs;
	var xAxisLabel = chartData.xAxisLabel;
	var yAxisLabel = chartData.yAxisLabel;

	var xValuesOnly = [];
	var value;
	for(value in xValueIDs)
		xValuesOnly.push(value);

	var yValuesOnly = [];
	for(value in yValueIDs)
		yValuesOnly.push(value);

	return lines && lines.length ? {
		chart: {
			type: "bubble"
			, zoomType: "xy"
			, plotBackgroundColor: "white"
			, plotShadow: true
			, plotBorderWidth: 1
		}
		, title: {
			text: ""
		}
		, subtitle: {
				text: document.ontouchstart === undefined ?
					'Click and drag in the plot area to zoom in <br/> Click on a legend item to turns the series on/off' :
					'Pinch the chart to zoom in <br/> Tap on a legend item to turns the series on/off'
		}
		, xAxis: {
			title: {
				text: xAxisLabel
			}
			, categories: xValuesOnly
			, labels: {
				rotation: -45
				, align: 'right'
			}
		}
		, yAxis: {
			title: {
				text: yAxisLabel
			}
			, categories: yValuesOnly
			, labels: {
				align: 'right'
			}
			, minorGridLineWidth: 0
			, gridLineWidth: 0
			, alternateGridColor: null
		}
		, tooltip: {
			formatter: function() {
				return "<small>" + this.series.name + "</small><br />"
					+ xAxisLabel + ": <b>" + this.x + "</b><br />"
					+ yAxisLabel + ": <b>" + yValuesOnly[this.y] + "</b><br />"
					+ "Count: <b>" + this.point.z + " post(s)</b>";
			}
		}
		, legend: {
			layout: 'vertical'
			, align: 'right'
			, verticalAlign: 'middle'
			, borderWidth: 0
		}
		, series: lines
	} : null;
}

function describeChart_distribution(chartData) {
	var lines = chartData.lines;
	var query = chartData.query;

	return lines && lines.length ? {
		chart: {
			plotBackgroundColor: null
			, plotBorderWidth: null
			, plotShadow: false
		}
		, title: {
			text: query
		}
		, tooltip: {
			pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
		}
		, plotOptions: {
			pie: {
				allowPointSelect: true
				, cursor: 'pointer'
				, dataLabels: {
					enabled: true
					, color: '#000000'
					, connectorColor: '#000000'
					, format: '<b>{point.name}</b>: {point.percentage:.1f} %'
				}
			}
		}
		, series: lines
	} : null;
}

///////////////////////////////////////////////////////////////////
// Common function to draw the chart descriptor using Highcharts //
///////////////////////////////////////////////////////////////////
function drawChart(container, chartDescriptor) {
	// Multiple charts to draw in one container?
	if($.isArray(chartDescriptor)) {

		// Yes, please!
		container.html(""); // clear out the container
		for(var index in chartDescriptor) {
			// Add a new plot for each chart descriptor
			var subContainer = $("<div class='col-lg-12'></div>");
			container.append(subContainer);
			subContainer.highcharts(chartDescriptor[index]);
		}

	} else {
		// No, just one, thank you!
		if(chartDescriptor && chartDescriptor !== "")
			container.highcharts(chartDescriptor);
	}
}
