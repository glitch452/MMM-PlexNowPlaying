/* global Module */

/**
 * Magic Mirror
 * Module: MMM-PlexNowPlaying
 *
 * By David Dearden
 * MIT Licensed.
 */

//var axis, Log, config;

/**
 * Register the module with the MagicMirror program
 */
Module.register("MMM-PlexNowPlaying", {

	/**
	 * The default configuration options
	 */
	defaults: {
    serverURL: null,
    serverPort: 32400, // Integer, minimum 0
    xPlexToken: null,
    fontSize: "small",
    fontColor: "", // https://www.w3schools.com/cssref/css_colors_legal.asp
    updateInterval: 30, // Seconds, minimum 2
    retryDelay: 5, // Seconds, minimum 0
    userWhiteList: [],
    userBlackList: [],
    initialLoadDelay: 0, // Seconds, minimum 0
		developerMode: true
	},

	/**
	 * The minimum version of magic mirror that is required for this module to run.
	 */
	requiresVersion: "2.2.1",

	/**
	 * Override the start function.  Set some instance variables and validate the selected
	 * configuration options before loading the rest of the module.
	 */
	start: function() {
		var self = this;
		self.loaded = false;
    self.plexData = [];
    self.apiSessionsEndpoint = "status/sessions/";
    self.updateTimer = null;
		self.lastUpdateTime = new Date(0);
		self.maxDataAttempts = 3;
		self.validFontSizes = [ "x-small", "small", "medium", "large", "x-large" ];

    if (!axis.isString(self.config.serverURL) || 0 === self.config.serverURL.length) {
      self.log("A server URL is required. ", "error");
      return;
    }
    if (!axis.isString(self.config.xPlexToken) || 0 === self.config.xPlexToken.length) {
      self.log("An X-Plex-Token is required. ", "error");
      return;
    }

    if (axis.isNumber(self.config.serverPort) && !isNaN(self.config.serverPort) && self.config.serverPort >= 0) { self.config.serverPort = Math.floor(self.config.serverPort); }
		else { self.config.serverPort = self.defaults.serverPort; }

    if (axis.isNumber(self.config.initialLoadDelay) && !isNaN(self.config.initialLoadDelay) && self.config.initialLoadDelay >= 0) { self.config.initialLoadDelay = self.config.initialLoadDelay * 1000; }
		else { self.config.initialLoadDelay = self.defaults.initialLoadDelay * 1000; }

    if (axis.isNumber(self.config.updateInterval) && !isNaN(self.config.updateInterval) && self.config.updateInterval >= 0.03) { self.config.updateInterval = self.config.updateInterval * 1000; }
		else { self.config.updateInterval = self.defaults.updateInterval * 1000; }

    if (!self.validFontSizes.includes(self.config.fontSize)) { self.config.fontSize = self.defaults.fontSize; }
    if (!axis.isString(self.config.fontColor)) { self.config.fontColor = self.defaults.fontColor; }

    if (axis.isNumber(self.config.retryDelay) && !isNaN(self.config.retryDelay) && self.config.retryDelay >= 0) { self.config.retryDelay = self.config.retryDelay * 1000; }
		else { self.config.retryDelay = self.defaults.retryDelay * 1000; }

    self.apixPlexToken = self.config.xPlexToken;
    self.apiBaseURL = self.unTrailingSlashIt(self.config.serverURL);

		self.log(("start(): self.data: " + JSON.stringify(self.data)), "dev");
		self.log(("start(): self.config: " + JSON.stringify(self.config)), "dev");

    self.loaded = true;

    if (self.config.initialLoadDelay > 0) {
      self.log(self.translate("INITIAL_DELAY", { "seconds": (self.config.initialLoadDelay / 1000) }));
      setTimeout(function(){ self.getData(1); self.scheduleUpdate(); }, self.config.initialLoadDelay );
    } else {
      self.getData(1);
      self.scheduleUpdate();
    }

	},

	/**
	 * Override the suspend function that is called when the module instance is hidden.
	 * This method stops the update timer.
	 */
	suspend: function() {
    var self = this;
    self.log(self.translate("SUSPENDED") + ".");
    clearInterval(self.updateTimer);
  },

	/**
	 * Override the resume function that is called when the module instance is un-hidden.
	 * This method re-starts the update timer and calls for an update if the update interval
	 * has been passed since the module was suspended.
	 */
	resume: function() {
    var self = this;
		self.log(self.translate("RESUMED") + ".");
		self.scheduleUpdate();
		var date = new Date();
		var threshold = new Date( self.lastUpdateTime.getTime() + self.config.updateInterval );
		if (date >= threshold) { self.getData(1); }
  },

	/**
	 * The scheduleUpdate function starts the auto update timer.
	 */
	scheduleUpdate: function() {
    var self = this;
    self.updateTimer = setInterval(function() { self.getData(1); }, self.config.updateInterval);
    self.log( self.translate("UPDATE_SCHEDULED", { "seconds": (self.config.updateInterval / 1000) }) );
  },

	/**
	 * The getData function sends a request to the plex server to get the data
	 *
	 * @param attemptNum (number) The number of attempts to get the data
	 */
	getData: function(attemptNum) {
		var self = this;

    if (attemptNum > self.maxDataAttempts) {
      self.plexData = [];
      self.updateDom();
      self.log(self.translate("DATA_FAILURE"), "error");
      return;
    }

    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4) {
        if (this.status == 200) {
          self.log(self.translate("DATA_SUCCESS", { "numberOfAttempts": attemptNum }));
          self.parseData(this.responseText);
          self.updateDom();
        } else {
          self.log("Error: " + this.status + ": " + this.statusText, "warn");
          self.log(self.translate("DATA_FAILURE_RETRY", { "retryTimeInSeconds": (self.config.retryDelay / 1000) }), "warn");
          setTimeout(function() { self.getData(attemptNum + 1); }, self.config.retryDelay);
        }
      }
    };

    xhttp.open("GET", self.buildURL(self.apiSessionsEndpoint), true);
    xhttp.send();

	},

  /**
	 * The buildURL function takes an endpoint and wraps it in the base URL, port and plex token parameter
	 *
	 * @param endpoint (string) The endpoint to use when building the URL
   * @return (string) The fully qualified URL for the requested endpoint
	 */
  buildURL: function(endpoint) {
    var self = this;
    endpoint = this.trailingSlashIt(endpoint);
    endpoint = this.leadingSlashIt(endpoint);
    return self.apiBaseURL + ":" + self.config.serverPort + endpoint + "?X-Plex-Token=" + self.apixPlexToken;
  },

  /**
   * The parseData function takes the raw xml from the Plex server and extracts the useful info into a
   *   javascript object.  Then it saves the result to the plexData variable in the current object.
   *
   * @param rawXML (string) The xml stirng to parse
   */
  parseData: function(rawXML) {
    var self = this;

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(rawXML, "text/xml");
    var plexItems = xmlDoc.getElementsByTagName("MediaContainer")[0].getElementsByTagName("Video");

    var newData = [];

    for (var i = 0; i < plexItems.length; i++) {

      var xmlItem = plexItems[i];
      var item = {
        user: null,
        player: null,
        session: null,
        transcodeSession: null
      };
      item.type = xmlItem.getAttribute("type");

      if ("movie" === item.type) { // Get Movie Details
        item.libraryTitle = xmlItem.getAttribute("librarySectionTitle"); // "Movies"
        item.posterImg = xmlItem.getAttribute("thumb");
        item.bannerImg = xmlItem.getAttribute("art");
        item.title = xmlItem.getAttribute("title");
        item.year = xmlItem.getAttribute("year");
        item.rating = xmlItem.getAttribute("rating");
        item.studio = xmlItem.getAttribute("studio");
        item.originalTitle = xmlItem.getAttribute("originalTitle");
        item.contentRating = xmlItem.getAttribute("contentRating");
        item.duration = xmlItem.getAttribute("duration");
        item.viewOffset = xmlItem.getAttribute("viewOffset");
        item.libraryEndpoint = xmlItem.getAttribute("librarySectionKey");
      } else if ("episode" === item.type) { // Get TV Episode detailes
        item.libraryTitle = xmlItem.getAttribute("librarySectionTitle"); // "TV Shows"
        item.seriesTitle = xmlItem.getAttribute("grandparentTitle");
        item.seriesBannerImg = xmlItem.getAttribute("grandparentArt");
        item.seriesPosterImg = xmlItem.getAttribute("grandparentThumb");
        item.seasonPosterImg = xmlItem.getAttribute("parentThumb");
        item.seasonTitle = xmlItem.getAttribute("parentTitle");
        item.seasonNumber = xmlItem.getAttribute("parentIndex");
        item.episodeNumber = xmlItem.getAttribute("index");
        item.contentRating = xmlItem.getAttribute("contentRating");
        item.title = xmlItem.getAttribute("title");
        item.year = xmlItem.getAttribute("year");
        item.thumbnailImg = xmlItem.getAttribute("thumb");
        item.duration = xmlItem.getAttribute("duration");
        item.viewOffset = xmlItem.getAttribute("viewOffset");
        item.libraryEndpoint = xmlItem.getAttribute("librarySectionKey");
      } else if ("clip" === item.type) { // Get Live TV Sessions
        item.title = "Live TV Session";
      } else {
        continue;
      }

      item.endpoint = xmlItem.getAttribute("key");

      if (0 < xmlItem.getElementsByTagName("User").length) {
        xmlUser = xmlItem.getElementsByTagName("User")[0];
        item.user = {};
        item.user.id = xmlUser.getAttribute("id");
        item.user.image = xmlUser.getAttribute("thumb");
        item.user.title = xmlUser.getAttribute("title");
      }

      if (0 < xmlItem.getElementsByTagName("Player").length) {
        xmlPlayer = xmlItem.getElementsByTagName("Player")[0];
        item.player = {};
        item.player.platform = xmlPlayer.getAttribute("platform"); // "webOS"
        item.player.platformVersion = xmlPlayer.getAttribute("platformVersion"); // "3.3.0"
        item.player.product = xmlPlayer.getAttribute("product"); // "Plex for LG"
        item.player.profile = xmlPlayer.getAttribute("profile"); // "HTML TV App"
        item.player.remotePublicAddress = xmlPlayer.getAttribute("remotePublicAddress"); // "24.246.83.152"
        item.player.state = xmlPlayer.getAttribute("state"); // "playing"
        item.player.title = xmlPlayer.getAttribute("title"); // "hoetname.local"
        item.player.version = xmlPlayer.getAttribute("version"); // "1.3.1.916-1cb2c34d"
        item.player.local = xmlPlayer.getAttribute("local"); // "0" | "1"
      }

      if (0 < xmlItem.getElementsByTagName("Session").length) {
        xmlSession = xmlItem.getElementsByTagName("Session")[0];
        item.session = {};
        item.session.id = xmlPlayer.getAttribute("id"); // "y4v3cia926n1srcz8ncfgqnt"
        item.session.bandwidth = xmlPlayer.getAttribute("bandwidth"); // "27042"
        item.session.location = xmlPlayer.getAttribute("location"); // "lan" | "wan"
      }

      if (0 < xmlItem.getElementsByTagName("TranscodeSession").length) {
        xmlTranscodeSession = xmlItem.getElementsByTagName("TranscodeSession")[0];
        item.transcodeSession = {};
        item.transcodeSession.endpoint = xmlTranscodeSession.getAttribute("key"); // "/transcode/sessions/dh1t4wwpgin6holrnh5b0tsr"
        item.transcodeSession.throttled = xmlTranscodeSession.getAttribute("throttled"); // "0"
        item.transcodeSession.complete = xmlTranscodeSession.getAttribute("complete"); // "0"
        item.transcodeSession.progress = xmlTranscodeSession.getAttribute("progress"); // "-1"
        item.transcodeSession.speed = xmlTranscodeSession.getAttribute("speed"); // "1.8999999761581421"
        item.transcodeSession.duration = xmlTranscodeSession.getAttribute("duration"); // "7200000"
        item.transcodeSession.context = xmlTranscodeSession.getAttribute("context"); // "streaming"
        item.transcodeSession.sourceVideoCodec = xmlTranscodeSession.getAttribute("sourceVideoCodec"); // "mpeg2video"
        item.transcodeSession.videoDecision = xmlTranscodeSession.getAttribute("videoDecision"); // "transcode"
        item.transcodeSession.audioDecision = xmlTranscodeSession.getAttribute("audioDecision"); // "transcode"
        item.transcodeSession.protocol = xmlTranscodeSession.getAttribute("protocol"); // "dash"
        item.transcodeSession.container = xmlTranscodeSession.getAttribute("container"); // "mp4"
        item.transcodeSession.videoCodec = xmlTranscodeSession.getAttribute("videoCodec"); // "h264"
        item.transcodeSession.audioCodec = xmlTranscodeSession.getAttribute("audioCodec"); // "aac"
        item.transcodeSession.audioChannels = xmlTranscodeSession.getAttribute("audioChannels"); // "2"
        item.transcodeSession.transcodeHwRequested = xmlTranscodeSession.getAttribute("transcodeHwRequested"); // "1"
        item.transcodeSession.maxOffsetAvailable = xmlTranscodeSession.getAttribute("maxOffsetAvailable"); // "4.0040040040040044"
        item.transcodeSession.minOffsetAvailable = xmlTranscodeSession.getAttribute("minOffsetAvailable"); // "0"
      }

      newData.push(item);
    }

    self.plexData = newData;
    console.log("plexData: " + JSON.stringify(self.plexData), "dev");
  },

	/**
	 * Override the notificationReceived function.
	 * For now, there are no actions based on system or module notifications.
	 *
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 * @param sender (object) The module that the notification originated from
	 */
	notificationReceived: function(notification, payload, sender) {
		var self = this;

		if (sender) { // If the notification is coming from another module
			if (notification === "CURRENTWEATHER_DATA") {

			}
		} else if (notification === "ALL_MODULES_STARTED") {

		}
	},

	/**
	 * Override the getDom function to generate the DOM objects to be displayed for this module instance
	 */
	getDom: function() {
		var self = this;

		var wrapper = document.createElement("div");

    if (!self.loaded) {
      wrapper.classList.add("loading");
      wrapper.classList.add("small");
      wrapper.innerHTML += self.translate("LOADING");
      return wrapper;
    }

    if (0 === self.plexData.length) {
      wrapper.style.display = "none";
    } else {

      var table = document.createElement("table");
      for (var i = 0; i < self.plexData.length; i++) {
        var item = self.plexData[i];

        var row = document.createElement("tr");

        var userTable = document.createElement("table");
        userTable.setAttribute("class", "userTable");
        if (item.user) {
          if (item.user.image) {
            var userImgCell = document.createElement("td");
            userImgCell.setAttribute("class", "userImgCell");
            var userImage = document.createElement("img");
            userImage.setAttribute("class", "userImg");
            userImage.setAttribute("src", item.user.image);
            userImgCell.appendChild(userImage);
            userTable.appendChild(userImgCell);
          }
          var userDataCell = document.createElement("td");
          userDataCell.setAttribute("class", "userDataCell");
          userDataCell.innerHTML = item.user.title;
          userTable.appendChild(userDataCell);
        }

        var procressRow = null;
        if (item.duration && item.viewOffset) {
          procressRow = document.createElement("tr");
          procressRow.setAttribute("class", "progressBarRow");
          procressCell = document.createElement("td");
          procressCell.setAttribute("colspan", 2);
          var progressBar = document.createElement("div");
          progressBar.setAttribute("class", "progressBar");
          progressBar.style.width = String(Math.round(item.viewOffset / item.duration * 100)) + "%"
          procressCell.appendChild(progressBar);
          procressRow.appendChild(procressCell);
        }

        var stateIcon = document.createElement("span");
        if (item.player.state) {
          if ("playing" === item.player.state) {
            stateIcon.setAttribute("class", "state-icon far fa-play-circle");
          } else if ("paused" === item.player.state) {
            stateIcon.setAttribute("class", "state-icon far fa-pause-circle");
          }
        }

        if ("episode" === item.type) {

          var dataCell = document.createElement("td");
          dataCell.setAttribute("class", "dataCell");
          dataCell.innerHTML += item.seriesTitle;
          var secondary = document.createElement("div");
          secondary.setAttribute("class", "secondary-text");
          secondary.appendChild(stateIcon);
          secondary.innerHTML += "S" + item.seasonNumber + " &bull; E" + item.episodeNumber;
          dataCell.appendChild(secondary);
          var imageCell = document.createElement("td");
          if (item.seriesPosterImg || item.seasonPosterImg) {
            imageCell.setAttribute("class", "posterImgCell");
            var image = document.createElement("img");
            image.setAttribute("src", self.buildURL(item.seriesPosterImg ? item.seriesPosterImg : item.seasonPosterImg));
            image.setAttribute("class", "posterImg");
            imageCell.appendChild(image);
          } else {
            imageCell.setAttribute("class", "iconImgCell");
            var icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-tv");
            imageCell.appendChild(icon);
          }
          row.appendChild(imageCell);
          if (item.user) {
            dataCell.append(userTable);
          }
          row.appendChild(dataCell);

        } else if ("movie" === item.type) {

          var dataCell = document.createElement("td");
          dataCell.setAttribute("class", "dataCell");
          dataCell.innerHTML += item.title;
          var secondary = document.createElement("div");
          secondary.setAttribute("class", "secondary-text");
          secondary.appendChild(stateIcon);
          secondary.innerHTML += item.year;
          dataCell.appendChild(secondary);
          var imageCell = document.createElement("td");
          if (item.posterImg) {
            imageCell.setAttribute("class", "posterImgCell");
            var image = document.createElement("img");
            image.setAttribute("src", self.buildURL(item.posterImg));
            image.setAttribute("class", "posterImg");
            imageCell.appendChild(image);
          } else {
            imageCell.setAttribute("class", "iconImgCell");
            var icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-film");
            imageCell.appendChild(icon);
          }
          row.appendChild(imageCell);
          if (item.user) {
            dataCell.append(userTable);
          }
          row.appendChild(dataCell);

        } else if ("clip" === item.type) {

          var imageCell = document.createElement("td");
          imageCell.setAttribute("class", "iconImgCell");
          var icon = document.createElement("span");
          icon.setAttribute("class", "fa fa-broadcast-tower");
          imageCell.appendChild(icon);
          row.appendChild(imageCell);
          var dataCell = document.createElement("td");
          dataCell.setAttribute("class", "dataCell");
          dataCell.appendChild(stateIcon);
          dataCell.innerHTML += item.title;
          if (item.user) {
            dataCell.append(userTable);
          }
          row.appendChild(dataCell);

        }

        table.appendChild(row);
        if (null !== procressRow) {
          table.appendChild(procressRow);
        }

      }

      wrapper.classList.add(self.config.fontSize);
      if (self.config.fontColor.length > 0) { wrapper.style.color = self.config.fontColor; }
      wrapper.appendChild(table);

    }

		return wrapper;
	},

  /**
   * The trailingSlashIt function makes sure there is exactly one trailing slash after the input string
   *
   * @param input (string) The string apply the trailing slash to
   * @return (string) The input string with a single trailing slash
   */
  trailingSlashIt: function(input) {
    return this.unTrailingSlashIt(input) + "/";
  },

  /**
   * The unTrailingSlashIt function makes sure there is no trailing slash after the input string
   *
   * @param input (string) The string remove the trailing slash from
   * @return (string) The input string with no trailing slash
   */
  unTrailingSlashIt: function(input) {
    return input.replace(new RegExp("[\\/]+$"), "");
  },

  /**
   * The leadingSlashIt function makes sure there is exactly one leading slash at the beginning of the input string
   *
   * @param input (string) The string apply the leading slash to
   * @return (string) The input string with a single slash at the beginning
   */
  leadingSlashIt: function(input) {
    return "/" + this.unLeadingSlashIt(input);
  },

  /**
   * The unLeadingSlashIt function makes sure there is no leading slash at the beginning of the input string
   *
   * @param input (string) The string remove the leading slash from
   * @return (string) The input string with no slashes at the beginning
   */
  unLeadingSlashIt: function(input) {
    return input.replace(new RegExp("^[\\/]+"), "");
  },

	/**
	 * Override the getScripts function to load additional scripts used by this module.
	 */
	getScripts: function() {
		var scripts = [];
		if (typeof axis !== "object") { scripts.push(this.file("scripts/axis.js")); }
		return scripts;
	},


	/**
	 * Override the getStyles function to load CSS files used by this module.
	 */
	getStyles: function () {
		return [
			"MMM-PlexNowPlaying.css",
			"font-awesome.css"
		];
	},


	/**
	 * Override the getTranslations function to load translation files specific to this module.
	 */
	getTranslations: function() {
		return {
			en: "translations/en.json"
		};
	},

	/**
	 * The log function is a convenience alias that sends a message to the console.
	 * This is an alias for the MagicMirror Log functions with a developer mode feature added.
	 * This function prepends the module name to the message.
	 *
	 * @param message (string) The message to be sent to the console
	 * @param type (string) The type of message (dev, error, info, log)
	 */
	log: function(message, type) {
		var self = this;
		if (self.config.developerMode) {
			var date = new Date();
			var time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
			message = self.name + ": (" + self.data.index + ")(" + time + ") " + message;
		} else { message = self.name + ": " + message; }
		switch (type) {
			case "error": Log.error(message); break;
			case "warn": Log.warn(message); break;
			case "info": Log.info(message); break;
			case "dev": if (self.config.developerMode) { Log.log(message); } break;
			default: Log.log(message);
		}
	}

});
