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
    showUser: true,
    showPoster: true,
    showStatusIcons: true,
    fontSize: "small",
    fontColor: "", // https://www.w3schools.com/cssref/css_colors_legal.asp
    updateInterval: 30, // Seconds, minimum 2
    retryDelay: 5, // Seconds, minimum 0
    userWhiteList: [],
    userBlackList: [],
    userNameReplace: {},
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
    self.plexData = null;
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

    if (!axis.isBoolean(self.config.showUser)) { self.config.showUser = self.defaults.showUser; }
    if (!axis.isBoolean(self.config.showPoster)) { self.config.showPoster = self.defaults.showPoster; }
    if (!axis.isBoolean(self.config.showStatusIcons)) { self.config.showStatusIcons = self.defaults.showStatusIcons; }

    // validate arrays of strings
    var listOfArrays = [ "userWhiteList", "userBlackList" ];
    listOfArrays.forEach(function(arr) {
      if (axis.isArray(self.config[arr])) {
        var temp = [];
        self.config[arr].forEach(function(str) {
          if (axis.isString(str)) { temp.push(str); }
        });
        self.config[arr] = temp;
      } else {
        self.config[arr] = self.default[arr];
      }
    });

    //self.config.userNameReplace

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

    var newData = [];

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(rawXML, "text/xml");
    var mediaContainer = xmlDoc.getElementsByTagName("MediaContainer");
    var xmlItems = mediaContainer.length > 0 ? mediaContainer[0].children : [];

    for (var i = 0; i < xmlItems.length; i++) {

      var xmlItem = xmlItems[i];
      var item = {
        user: null,
        player: null,
        session: null,
        transcodeSession: null
      };
      item.type = xmlItem.getAttribute("type");

      switch (item.type) {
        case "movie": // Get Movie Details
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
          break;
        case "episode": // Get TV Episode details
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
          break;
        case "track": // Get Audio Track Details
          item.bannerImg = xmlItem.getAttribute("art"); // "/library/metadata/128396/art/1570920387"
          item.artistBannerImg = xmlItem.getAttribute("grandparentArt"); // "/library/metadata/128396/art/1570920387"
          item.artistThumbImg = xmlItem.getAttribute("grandparentArt"); // "/library/metadata/128396/thumb/1570920387"
          item.artistEndpoint = xmlItem.getAttribute("grandparentKey"); // "/library/metadata/128396"
          item.artistTitle = xmlItem.getAttribute("grandparentTitle"); // "Imagine Dragons"
          item.trackNumber = xmlItem.getAttribute("index"); // "1"
          item.libraryEndpoint = xmlItem.getAttribute("librarySectionKey"); // "/library/sections/17"
          item.libraryTitle = xmlItem.getAttribute("librarySectionTitle"); // "Music"
          item.albumNumber = xmlItem.getAttribute("parentIndex"); // "1"
          item.albumEndpoint = xmlItem.getAttribute("parentKey"); // "/library/metadata/128397"
          item.albumThumbImg = xmlItem.getAttribute("parentThumb"); // "/library/metadata/128397/thumb/1570920398"
          item.albumTitle = xmlItem.getAttribute("parentTitle"); // "Evolve"
          item.thumbImage = xmlItem.getAttribute("thumb"); // "/library/metadata/128397/thumb/1570920398"
          item.title = xmlItem.getAttribute("title"); // "I Don’t Know Why"
          item.duration = xmlItem.getAttribute("duration");
          item.viewOffset = xmlItem.getAttribute("viewOffset");
          item.libraryEndpoint = xmlItem.getAttribute("librarySectionKey");
          break;
        case "photo": // Get Photo Details
          item.title = xmlItem.getAttribute("title"); // "Ceremony-42"
          item.thumbImg = xmlItem.getAttribute("thumb"); //"/library/metadata/135467/thumb/1571068069"
          item.libraryEndpoint = xmlItem.getAttribute("librarySectionKey"); // "/library/sections/18"
          item.libraryTitle = xmlItem.getAttribute("librarySectionTitle"); // "Photos"
          item.parentFolderTitle = xmlItem.getAttribute("parentTitle"); // "Ceremony"
          item.year = xmlItem.getAttribute("year"); // "2017"
          item.bannerImg = xmlItem.getAttribute("art"); // "/library/metadata/135458/art/1571068088"
          item.parentFolderBannerImg = xmlItem.getAttribute("parentThumb"); // "/library/metadata/135458/thumb/1571068088"
          break;
        case "clip": // Get Other Video Details
          item.subtype = xmlItem.getAttribute("subtype"); // "trailer"
          if (null !== item.subtype && "trailer" === item.subtype) { // Get trailer Sessions
            item.type = "trailer";
            item.title = xmlItem.getAttribute("title");
            item.bannerImg = xmlItem.getAttribute("art");
            item.duration = xmlItem.getAttribute("duration");
            item.viewOffset = xmlItem.getAttribute("viewOffset");
          } else if (xmlItem.getAttribute("title").indexOf("Live Session") >= 0) { // Get Live TV Sessions=
            item.title = "Live TV Session";
            item.type = "livetv";
          } else {
            item.title = xmlItem.getAttribute("title");
            item.duration = xmlItem.getAttribute("duration");
            item.viewOffset = xmlItem.getAttribute("viewOffset");
          }
          break;
        default: continue;
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
        item.player.title = xmlPlayer.getAttribute("title"); // "hostname.local"
        item.player.version = xmlPlayer.getAttribute("version"); // "1.3.1.916-1cb2c34d"
        item.player.local = xmlPlayer.getAttribute("local"); // "0" | "1"
        item.player.secure = xmlPlayer.getAttribute("secure"); // "0" | "1"
      }

      if (0 < xmlItem.getElementsByTagName("Session").length) {
        xmlSession = xmlItem.getElementsByTagName("Session")[0];
        item.session = {};
        item.session.id = xmlSession.getAttribute("id"); // "y4v3cia926n1srcz8ncfgqnt"
        item.session.bandwidth = xmlSession.getAttribute("bandwidth"); // "27042"
        item.session.location = xmlSession.getAttribute("location"); // "lan" | "wan"
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

      if (!item.user || (!self.config.userBlackList.includes(item.user.title) &&
          (0 === self.config.userWhiteList.length || self.config.userWhiteList.includes(item.user.title))
          )) {
        newData.push(item);
      }

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
    var icon;

		var wrapper = document.createElement("div");

    if (!self.loaded || null === self.plexData) {
      wrapper.classList.add("loading");
      wrapper.classList.add("small");
      wrapper.innerHTML = self.translate("LOADING");
      return wrapper;
    }

    if (0 === self.plexData.length) {

      var mainTable = document.createElement("table");
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      wrapper.appendChild(mainTable);
      mainTable.appendChild(row);
      row.appendChild(cell);
      mainTable.setAttribute("class", "no-streams-table");
      icon = document.createElement("span");
      icon.setAttribute("class", "fa fa-film");
      cell.appendChild(icon);
      icon = document.createElement("span");
      icon.setAttribute("class", "fa fa-tv");
      cell.appendChild(icon);
      icon = document.createElement("span");
      icon.setAttribute("class", "fa fa-music");
      cell.appendChild(icon);
      icon = document.createElement("span");
      icon.setAttribute("class", "fa fa-broadcast-tower");
      cell.appendChild(icon);
      icon = document.createElement("span");
      icon.setAttribute("class", "fa fa-images");
      cell.appendChild(icon);
      return wrapper;

    } else {

      var mainTable = document.createElement("table");

      for (var i = 0; i < self.plexData.length; i++) {
        var item = self.plexData[i];

        var userTable = document.createElement("table");
        userTable.setAttribute("class", "userTable");
        if (item.user && self.config.showUser) {
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

        var dataCell = document.createElement("td");
        var imageCell = document.createElement("td");
        dataCell.setAttribute("class", "dataCell");

        switch (item.type) {
          case "episode":
            dataCell.appendChild(document.createTextNode(item.seriesTitle));
            var secondary = document.createElement("div");
            secondary.setAttribute("class", "secondary-text");
            secondary.innerHTML += "S" + item.seasonNumber + " &bull; E" + item.episodeNumber;
            dataCell.appendChild(secondary);
            if (item.seriesPosterImg || item.seasonPosterImg) {
              imageCell.setAttribute("class", "posterImgCell");
              var image = document.createElement("img");
              image.setAttribute("src", self.buildURL(item.seriesPosterImg ? item.seriesPosterImg : item.seasonPosterImg));
              image.setAttribute("class", "posterImg");
              imageCell.appendChild(image);
            } else {
              imageCell.setAttribute("class", "iconImgCell");
              icon = document.createElement("span");
              icon.setAttribute("class", "fa fa-tv");
              imageCell.appendChild(icon);
            }
            break;
          case "movie":
            dataCell.appendChild(document.createTextNode(item.title));
            var secondary = document.createElement("div");
            secondary.setAttribute("class", "secondary-text");
            if (null !== item.year) {
              secondary.appendChild(document.createTextNode(item.year));
            }
            dataCell.appendChild(secondary);
            if (item.posterImg) {
              imageCell.setAttribute("class", "posterImgCell");
              var image = document.createElement("img");
              image.setAttribute("src", self.buildURL(item.posterImg));
              image.setAttribute("class", "posterImg");
              imageCell.appendChild(image);
            } else {
              imageCell.setAttribute("class", "iconImgCell");
              icon = document.createElement("span");
              icon.setAttribute("class", "fa fa-film");
              imageCell.appendChild(icon);
            }
            break;
          case "trailer":
            dataCell.appendChild(document.createTextNode(item.title));
            var secondary = document.createElement("div");
            secondary.setAttribute("class", "secondary-text");
            secondary.appendChild(document.createTextNode("Trailer"));
            dataCell.appendChild(secondary);
            imageCell.setAttribute("class", "iconImgCell");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-film");
            imageCell.appendChild(icon);
            break;
          case "track":
            dataCell.appendChild(document.createTextNode(item.title));
            var artist = document.createElement("div");
            artist.setAttribute("class", "secondary-text");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-user icon-mr");
            artist.appendChild(icon);
            artist.appendChild(document.createTextNode(item.artistTitle));
            dataCell.appendChild(artist);
            var album = document.createElement("div");
            album.setAttribute("class", "secondary-text");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-compact-disc icon-mr");
            album.appendChild(icon);
            album.appendChild(document.createTextNode(item.albumTitle));
            dataCell.appendChild(album);
            if (item.albumThumbImg) {
              imageCell.setAttribute("class", "thumbImgCell");
              var image = document.createElement("img");
              image.setAttribute("src", self.buildURL(item.albumThumbImg));
              image.setAttribute("class", "thumbImg");
              imageCell.appendChild(image);
            } else {
              imageCell.setAttribute("class", "iconImgCell");
              icon = document.createElement("span");
              icon.setAttribute("class", "fa fa-music");
              imageCell.appendChild(icon);
            }
            break;
          case "photo":
            dataCell.appendChild(document.createTextNode(item.title));
            var folder = document.createElement("div");
            folder.setAttribute("class", "secondary-text");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-folder-open icon-mr");
            folder.appendChild(icon);
            folder.appendChild(document.createTextNode(item.parentFolderTitle));
            dataCell.appendChild(folder);
            if (item.thumbImg) {
              imageCell.setAttribute("class", "thumbImgCell");
              var image = document.createElement("img");
              image.setAttribute("src", self.buildURL(item.thumbImg));
              image.setAttribute("class", "thumbImg");
              imageCell.appendChild(image);
            } else {
              imageCell.setAttribute("class", "iconImgCell");
              icon = document.createElement("span");
              icon.setAttribute("class", "fa fa-images");
              imageCell.appendChild(icon);
            }
            break;
          case "livetv":
            imageCell.setAttribute("class", "iconImgCell");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-broadcast-tower");
            imageCell.appendChild(icon);
            var dataCell = document.createElement("td");
            dataCell.setAttribute("class", "dataCell");
            dataCell.appendChild(document.createTextNode(item.title));
            break;
          default:
            imageCell.setAttribute("class", "iconImgCell");
            icon = document.createElement("span");
            icon.setAttribute("class", "fa fa-play");
            imageCell.appendChild(icon);
            var dataCell = document.createElement("td");
            dataCell.setAttribute("class", "dataCell");
            dataCell.appendChild(document.createTextNode(item.title));
        }

        if (item.user && self.config.showUser) {
          dataCell.append(userTable);
        }

        var itemContentTable = document.createElement("table");
        var itemContentTableRow = document.createElement("tr");
        itemContentTable.appendChild(itemContentTableRow);
        if (self.config.showPoster) { itemContentTableRow.appendChild(imageCell); }
        itemContentTableRow.appendChild(dataCell);
        if (self.config.showStatusIcons && null !== item.player) {
          var iconCell = document.createElement("td");
          iconCell.setAttribute("class", "iconCell");
          icon = document.createElement("span");
          icon.setAttribute("class", ("playing" === item.player.state) ? "fa fa-play-circle" : "fa fa-pause-circle");
          iconCell.appendChild(icon);
          icon = document.createElement("span");
          iconCell.appendChild(document.createElement("br"));
          icon.setAttribute("class", ("1" === item.player.local) ? "fa fa-network-wired" : "fa fa-globe");
          iconCell.appendChild(icon);
          icon = document.createElement("span");
          iconCell.appendChild(document.createElement("br"));
          icon.setAttribute("class", ("1" === item.player.secure) ? "fa fa-lock" : "fa fa-lock-open");
          iconCell.appendChild(icon);
          itemContentTableRow.appendChild(iconCell);
        }

        var contentRow = document.createElement("tr");
        var contentCell = document.createElement("td");
        contentRow.appendChild(contentCell);
        contentCell.appendChild(itemContentTable);
        mainTable.appendChild(contentRow);

        var duration = Number(item.duration);
        var viewOffset = Number(item.viewOffset);

        if (!isNaN(duration) && !isNaN(viewOffset)) {
          progressRow = document.createElement("tr");
          progressRow.setAttribute("class", "progressBarRow");
          procressCell = document.createElement("td");
          procressCell.setAttribute("class", "progressBarCell");
          var progressBar = document.createElement("div");
          progressBar.setAttribute("class", "progressBar");
          progressBar.style.width = String(Math.round(viewOffset / duration * 100)) + "%"
          procressCell.appendChild(progressBar);
          progressRow.appendChild(procressCell);
          mainTable.appendChild(progressRow);
        }

        var spacerRow = document.createElement("tr");
        var spacerCell = document.createElement("td");
        spacerRow.setAttribute("class", "spacerRow");
        spacerCell.setAttribute("class", "spacerCell");
        spacerCell.appendChild(document.createElement("div"));
        spacerRow.appendChild(spacerCell);
        mainTable.appendChild(spacerRow);

      }

      wrapper.appendChild(mainTable);

    }

    wrapper.classList.add(self.config.fontSize);
    if (self.config.fontColor.length > 0) { wrapper.style.color = self.config.fontColor; }

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
