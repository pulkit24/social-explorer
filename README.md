# Social Explorer

***

Social Explorer is a light-weight tool to perform analysis of user interactions on Facebook and Twitter.

It performs searches over Facebook and Twitter public posts, and provides tools for analysing the results retrieved. Search can be customized as needed. Results from Facebook and Twitter are filtered for interesting information and combined intelligently. The program then offers several tools for analysis, charting and search performance measurement. Multiple searches can be conducted in one session to perform comparisons.

![Social Explorer](http://i.minus.com/ibeZhhzDVh7kEA.png)

## Can I control the sources?
Yes, you can choose whether to include Facebook and Twitter in the search scope, how many posts to retrieve from each, and particularly for Facebook, what type of posts to look through. More details below.

### Sources available:
* **Facebook:** You can choose the number of posts to retrieve from each of: public posts by users and public posts by relevant pages and groups.

a. **Public User Posts:** An obvious choice to search within, but likely to have high noise and low relevance. This returns posts made by users on their own (or on others’) profiles that have been explicitly marked as “public” by the authors, and deemed relevant to the search query by Facebook.

b. **Pages and Groups:** This source returns a list of fan pages and communities related to the queried game. However, this is only a list of pages and groups, not the actual user content posted on them. Not relevant for getting actual user content, but provided for completeness.

c. **Posts within Pages and Groups:** All user content within relevant pages and groups on Facebook. This source returns the most relevant data among all sources. The posts are either those made by the administrators of the Pages and Groups themselves, or by fans of the Pages and Groups. Fan-made posts are likely to be Public User Posts, and hence there may be duplicates in search results from these two sources.

* **Twitter:** You can choose the number of recent tweets to retrieve from the global Twitter feed.

The program also suggests alternatives to the search terms, allowing the user to cover all versions of a query name as part of one query. Alternatives include:
* Joining words (example _teamfortress_ for _team fortress_)
* Simple hash tags (example _#teamfortress_ for _team fortress_)
* Joined words by hyphens (example _team-fortress_ for _team fortress_)
This can be turned off if needed.

### Aren't the results from Facebook and Twitter different?
Since the information retrieved from Facebook and Twitter is differently structured, Social Explorer unifies the data before it presents it to the viewer and/or performs any analysis on it.

Information available after integration includes:
* Author's category and details - _who is talking about this search term?_
* Message content - _what are they talking about?_
* Time - _track the popularity of your topic of interest over time_
* Location, language and time zone - _assess geographical distribution_
* Media type - _what do people share the most?_
* Links - _help further judge the relevance of the results_

This can be turned off, if you wish to see the raw data returned by Twitter and Facebook. While this results in a lack of overlap between the results from these sources, it can be useful to analyse other information, such as mapping Twitter users' status counts to their follower counts (try it for some interesting insights!).

## Tools for analysis:
The program provides three levels of analysis:

### 1. Tabulated results
All results are presented as a table listing all information pieces for each query, along with the number of times the same post was shared, which can help highlight more popular postings.

Tables can be sorted, searched, filtered and downloaded as CSV. One can also drill-down the results by zooming-in using the Zoom button, to view to full messages being posted by the users.

### 2. Online charting
Several types of charts are plotted to visualise the data from different perspectives. You can choose which fields to plot on either axis as well, allowing for any level of analysis as needed.

* **Time series**
This chart plots the post counts over time. Important events and days of high community talks are immediately noticeable from this chart. One can zoom into any portion of the chart to dive deeper, zooming into week, day or even hourly level.

To further explore a peak day, the user can simply use the filter feature in results table (as described above) to find out the individual posts that occurred on that day.

![Time series](http://i.minus.com/iHfU2OtBwL1jq.png)

* **One-dimensional comparison chart**
To compare and contrast popularity of a particular field, use this chart. Shown here as an example, the user can choose to plot the Category field and see which games are more popular in which categories.
Other interesting uses of this chart include:
* Finding the most popular media shared by users: texts, images, videos, links, etc.
* Discover obscure categories of users and find their relations with your topic of interest.
* Compare each topic's popularity over different geographic locations and timezones, or across users who speak different languages.

![One-dimensional comparison chart](http://i.minus.com/ixPYxW2S0KCHW.png)

* **Cross-field comparison chart**
This two-dimensional chart is a very powerful tool to find correlations between two field types. Shown here, for example, is a mapping of post categories versus the media type. It concludes that there are more shares of photos in Video Game communities than videos and text for the game Age of Empires. Whereas Team Fortress players prefer to post in general gaming community forums and prefer to post texts or stories.

![Cross-field comparison chart](http://i.minus.com/i5Q4sfuM0496A.png)

* **Distribution plots**
Pie-charts are excellent visual tools to quickly find prominent fields, and compare them across different search queries. One pie-chart is plotted per query.

![Distribution plots](http://i.minus.com/i3NhtZv3DLAIY.png)

### 3. Performance Evaluation
Social Explorer provides a tool for calculating some essential performance measurements for each search. This can help scientifically validate your findings, and provide an immediate feedback on the quality and reliability of search results retrieved for any search query.

**Measures:**
Since the results aren't ranked in any order, and we are not aware of exact implementation details of the information retrieval process internally implemented by Facebook and Twitter, we cannot apply most of the traditional evaluation metrics, such as Mean Average Precision (MAP) and Cumulative Gain. Nevertheless, some primitive measures can still be calculated for a rudimentary performance score.

* Precision: Precision measures the relevance of search results by quantifying the number of relevant results among all the information retrieved from a search.
* Term frequencies: Another simply measure is the number of times the query (or its variants) appears in the post. This can be reports as:
1. As-is, which is likely to be incomparable across search results due to differences in total post counts and post lengths.
2. Averaged over the post count, to present a comparable per-post frequency of terms.
3. Weighted over the post length, which removes the bias stemming from long posts that are naturally likely to contain more instances of the search term.
The user is encouraged to make their own decisions using this metric, although as a rule of thumb the higher the frequency, the better the search result quality can be assumed.

![Performance evaluation](http://i.minus.com/iXzDek7KA7yDb.png)

## Caching
Results are cached by the server, so repeat queries perform quicker. To clear cache or change the expiry deadline, switch to the Connect tab and make the necessary changes in the Cache section.

## Notes
All charts are plotted using [Highcharts](http://www.highcharts.com/).

Angular table generated using [ng-table](https://github.com/esvit/ng-table).

## License
Copyright (c) 2012-2014 Pulkit Karwal
Licensed under the MIT license