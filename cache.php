<?php

require_once("config.php");

class Cache {

	/**
	-------------------
	Cache configuration parameters
	-------------------
	*/
	private $cache_folder = null;
	private $cache_index = null;
	private $cache_index_delimiter = null;
	private $blacklist = null; // ignore these query string params when matching URLs
	private $tempFileSuffix = null;

	private static $instance = null; // singleton instance

	public static function getInstance() {
		if(empty($instance))
			$instance = new Cache();
		return $instance;
	}

	public static function invalidate() {
		$instance = null;
	}

	private function __construct() {
		$config = Config::getInstance();

		// Get the settings
		$this->cache_folder = $config->get("cache", "folder");
		$this->cache_index = $config->get("cache", "indexFile");
		$this->cache_index_delimiter = $config->get("cache", "indexDelimiter");
		$this->blacklist = $config->get("cache", "blacklist"); // ignore these query string params when matching URLs
		$this->tempFileSuffix = $config->get("cache", "tempFileSuffix");

		// On create, ensure the cache folder and index files are available
		$this->createEnvironment();
	}


	/**
	-------------------
	Cache folder management
	-------------------
	*/

	// Empty the entire cache folder
	// include the index file
	// Warning: this will permanently delete all the cached files!
	public function emptyCache() {

		// Ensure that the cache folder is set and is not the current directory
		if(!empty($this->cache_folder) && $this->cache_folder !== dirname(__FILE__)) {

			// Delete all files recursively
			$this->recursive_rmdir($this->cache_folder);

			return true;
		}

		return false;
	}

	private function createEnvironment() {
		// Get the cache folder path
		$this->cache_folder = dirname(__FILE__) . "/" . $this->cache_folder;

		// Create one if it doesn't exist
		if(!file_exists($this->cache_folder))
			mkdir($this->cache_folder);

		// Get the index file path
		$indexFilepath = $this->cache_folder . "/" . $this->cache_index;

		// Create one if it doesn't exist
		if(!file_exists($indexFilepath))
			touch($indexFilepath);
	}

	private function recursive_rmdir($dir) {
		foreach(glob($dir . '/*') as $file) {
			if(is_dir($file))
				recursive_rmdir($file);
			else
				unlink($file);
		}
		rmdir($dir);
	}

	/**
	-------------------
	File caching functions
	-------------------
	*/

	// Get a file from a URL
	// Returns a local cached copy, if it exists, unless the expiry time has been exceeded
	// Cache expiry time should be in minutes
	// Optional: supply a file fetching function to use in place of the simple file_get_contents(), if needed
	public function fetchFile($liveURL = "", $cacheExpiryTime = -1, $liveFetchFunction = null) {

		// First, check if a local copy exists in the cache
		$fileContents = null;
		$localFilepath = $this->getEntry($liveURL);
		if(!empty($localFilepath)) {

			// Yes, it exists. Is it expired?
			$fileStats = stat($localFilepath);
			$cacheExpiryDeadline = $fileStats["ctime"] + $cacheExpiryTime * 60 * 1000; // add the expiry duration to the creation time
			if($cacheExpiryTime>=0 && $cacheExpiryDeadline <= time()) {

				// Yes, expired. Delete the entry and start afresh
				$this->removeEntry($liveURL, $localFilepath);
				unlink($localFilepath); // physically remove the file

				// Download afresh and return the contents
				return $this->fetchLiveFile($liveURL, $liveFetchFunction);

			} else {
				// No, not expired. Read and return from cache
				return file_get_contents($localFilepath);
			}

		} else {
			// No, there's no cached copy
			// Download afresh and return the contents
			return $this->fetchLiveFile($liveURL, $liveFetchFunction);
		}
	}

	// Utility function to fetch a live file and save it in the cache index
	// Use the previous function to test for cached copies and control cache expiry
	// Supply optional liveFetchFunction to handle the process of fetching data, instead of a file_get_contents()
	// Returns the file contents, or null if nothing was downloaded
	private function fetchLiveFile($liveURL = "", $liveFetchFunction = null) {

		// Download the file
		$fileContents = !empty($liveFetchFunction)
						? call_user_func($liveFetchFunction)
						: file_get_contents($liveURL);
		if(empty($fileContents))
			return null;

		// Save the file
		$localFilepath = $this->saveFile($liveURL, $fileContents);

		// If successfully saved, return the file contents
		if(!empty($localFilepath))
			return $fileContents;
		else
			return null;
	}

	// Makes a local (cached) copy of a file
	// Returns the local filepath, or null on failure
	private function saveFile($liveURL = "", $fileContents = "") {

		// Reserve a filename for saving
		$localFilename = $this->getNextFilename();

		// Save the data into this file
		$localFilepath = $this->cache_folder . "/" . $localFilename;
		$localFile = fopen($localFilepath, "w");
		if(empty($localFile))
			return null;
		fwrite($localFile, $fileContents);
		fclose($localFile);

		// Add the entry into the index
		$success = $this->addEntry($liveURL, $localFilepath);

		if($success)
			return $localFilepath;
		else
			return null;
	}

	// Utility function to get the next available filename to store the cache copy
	// Files are named as incrementing numbers, for ease and preventing collisions
	private function getNextFilename(){

		// Get the current file count
		$cacheFilesCount = iterator_count(new FilesystemIterator($this->cache_folder, FilesystemIterator::SKIP_DOTS));

		// Ensure no clashes
		$potentialFilename = $cacheFilesCount + 1;
		while(file_exists($this->cache_folder . "/" . $potentialFilename)) {
			$potentialFilename++;
		}

		// Prepare and reserve the next filename
		touch($this->cache_folder . "/" . $potentialFilename);

		// Return this name in good faith
		return $potentialFilename;
	}

	/**
	-------------------
	Cache index management
	-------------------
	*/

	// Makes an entry in the cache index
	// Entry format is {live URL} {delimiter} {local URL}
	// Returns true on success
	private function addEntry($liveURL = "", $localURL = "") {

		// Open the index file
		$indexFile = fopen($this->cache_folder . "/" . $this->cache_index, "a");
		if(empty($indexFile))
			return false;

		// Strip out blacklisted params
		foreach ($this->blacklist as $part)
			$liveURL = preg_replace("/[\?&]$part=[^&\s]*/", "", $liveURL);

		// Construct and append the new entry
		fwrite($indexFile, $liveURL . $this->cache_index_delimiter . $localURL . "\n");

		// Done!
		fclose($indexFile);
		return true;
	}

	// Retrieves the local filepath of a supplied live file URL
	// Returns null if no cache exists
	private function getEntry($liveURL = "") {

		// Strip out blacklisted params
		foreach ($this->blacklist as $part)
			$liveURL = preg_replace("/[\?&]$part=[^&\s]*/", "", $liveURL);

		// Open the index file
		$indexFile = fopen($this->cache_folder . "/" . $this->cache_index, "r");
		if(empty($indexFile))
			return null;

		// Iterate through the index
		$entry = null;
		do {
			// Fetch an entry
			$entry = fgets($indexFile);
			if(empty($entry)) continue; // skip blanks

			// Get the live URL from the entry
			$URLs = explode($this->cache_index_delimiter, $entry);
			if(count($URLs) < 2) continue; // skip blanks/corrupt entries
			$potentialLiveURL = trim($URLs[0]);
			$potentialLocalURL = trim($URLs[1]);

			// Does it match?
			if($potentialLiveURL === $liveURL){
				// Yes! Gracefully shut the file and return the corresponding local filepath
				fclose($indexFile);
				return $potentialLocalURL; // return the local filepath
			}
			// Else continue searching

		} while($entry !== false);

		// Done, but without a match!
		fclose($indexFile);
		return null; // notify of no match
	}

	// Deletes an entry from the index table
	// Helpful for purging expired cache files
	// (Note: the responsibility of actually deleting the file belongs to the caller)
	// Returns true on success, false otherwise
	private function removeEntry($liveURL = "", $localURL = "") {

		// Open the index file
		$indexFilepath = $this->cache_folder . "/" . $this->cache_index;
		$indexFile = fopen($indexFilepath, "r");
		if(empty($indexFile))
			return false;

		// Create a temporary file for the updates
		$tempFilepath = $this->cache_folder . "/" . $this->cache_index . $this->tempFileSuffix;
		touch($tempFilepath);
		$updatedIndexFile = fopen($tempFilepath, "a");

		// Iterate through the index
		$entry = null;
		do {
			// Fetch an entry
			$entry = fgets($indexFile);
			if(empty($entry)) continue; // skip blanks

			// Get the live URL
			$URLs = explode($this->cache_index_delimiter, $entry);
			if(count($URLs) < 2) continue; // skip blanks/corrupt entries
			$potentialLiveURL = trim($URLs[0]);
			$potentialLocalURL = trim($URLs[1]);

			// Does it match?
			if($potentialLiveURL === $liveURL && $potentialLocalURL === $localURL){
				// Yes! Do not add this entry. It is to be deleted
			} else {
				// Add this entry into the updated index file
				fwrite($updatedIndexFile, $entry . "\n");
			}

		} while($entry !== false);

		// Gracefully shut the files
		fclose($indexFile);
		fclose($updatedIndexFile);

		// Finally, replace the index with the updated one
		rename($tempFilepath, $indexFilepath);

		return true; // notify of success
	}

}

?>