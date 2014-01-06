<?php

class Config {

	private $configFile = "config.json";
	private $configData = null;
	private $configFilePath = null;

	// Singleton instance
	private static $instance = null;

	// Get the singleton instance (to avoid recreating instances across requests)
	public static function getInstance() {
		if(empty($instance))
			$instance = new Config();

		return $instance;
	}

	private function __construct() {
		// Determine the full file path
		$this->configFilePath = dirname(__FILE__) . "/" . $this->configFile;

		// On load, read the config file
		$fileContents = file_get_contents($this->configFilePath);

		// Process the json
		$this->configData = json_decode($fileContents);
	}

	// Returns a requested configuration setting
	// If a subKey is present, then it returns the value
	// found inside the key called subKey inside the key supplied. 
	public function get($key, $subKey = null) {
		if(empty($subKey))
			return $this->configData->$key;
		else
			return $this->configData->$key->$subKey;
	}

	// Updates a particular configuration setting
	// Supply a subKey to target a key within the specified key.
	// Or supply null for subKey if none needed.
	// Note: DOES NOT SAVE!
	public function set($key, $subKey, $value) {
		if(empty($subKey))
			$this->configData->$key = $value;
		else
			$this->configData->$key->$subKey = $value;
	}

	// Saves any changes to make them permanent
	public function save() {
		file_put_contents($this->configFilePath, json_encode($this->configData));
	}

	// Marshal all the config data into a single line of string.
	// Useful for passing over the network as encoded JSON data.
	public function serialize() {
		return json_encode($this->configData);
	}
}
?>
