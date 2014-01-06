<?php

require_once("config.php");

class SearchTracker {

	// Statistics
	private $queriesExpected;
	private $queriesCompleted;

	// Save the stats in this file for direct client access
	private $trackerFile;

	public function __construct($queryID) {
		$config = Config::getInstance();

		$this->queriesExpected = 0;
		$this->queriesCompleted = 0;

		$trackerFolder = dirname(__FILE__) . "/" . $config->get("search", "progressTrackerFolder");

		if(!file_exists($trackerFolder))
			mkdir($trackerFolder);

		$this->trackerFile = $trackerFolder . "/" . $config->get("search", "progressTrackerFile") . $queryID;

		if(!file_exists($this->trackerFile))
			touch($this->trackerFile);
	}

	private function marshal() {
		$progress = array();
		$progress["total"] = $this->queriesExpected;
		$progress["completed"] = $this->queriesCompleted;

		return json_encode($progress);
	}

	private function saveFile() {
		$trackerFile = fopen($this->trackerFile, "w");
		fwrite($trackerFile, $this->marshal());
		fclose($trackerFile);
	}

	public function setQueriesExpected($queriesExpected) {
		$this->queriesExpected = $queriesExpected;
		$this->saveFile();
	}

	public function setQueriesCompleted($queriesCompleted) {
		$this->queriesCompleted = $queriesCompleted;
		$this->saveFile();
	}

	public function addQueriesExpected($amount) {
		$this->queriesExpected += $amount;
		$this->saveFile();
	}

	public function incrementQueriesCompleted() {
		$this->queriesCompleted++;
		$this->saveFile();
	}
}
?>
