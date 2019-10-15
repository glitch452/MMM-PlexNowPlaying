# MMM-PlexNowPlaying

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) smart mirror project.

This module displays the list of playback sessions for a [Plex Media Server](https://plex.tv).    

| Status  | Version | Date       | Maintained? | Minimum MagicMirror² Version |
|:------- |:------- |:---------- |:----------- |:---------------------------- |
| Working | `1.0.0` | 2019-10-14 | Yes         |`2.2.1`                       |

### Example
![Example of MMM-LocalTemperature](images/sample.png?raw=true "Example screenshot")

### Dependencies
1. A [Plex Media Server](https://plex.tv) installation for the source of the data

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br>`cd ~/MagicMirror/modules`
2. Copy the module to your computer by executing the following command:<br>`git clone https://github.com/glitch452/MMM-PlexNowPlaying.git`

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        ...
        {
            module: "MMM-PlexNowPlaying",
            position: "top_left",
            header: "Plex: Now Playing",
            config: {
                serverProtocol: "http",
                serverAddress: "x.x.x.x",
                serverPort: 32400,
                xPlexToken: "xxxxxxxxxxxxxxxxxxxx"
                ...
                // See below for more Configuration Options
            }
        },
        ...
    ]
}
```

### Configuration Options

| Option                  | Details
|:----------------------- |:-------------
| `serverAddress`         | **REQUIRED** - IP Address or Hostname of the server. <br>**Type:** `string`
| `xPlexToken`            | **REQUIRED** - An X-Plex-Token for a user that has access to the server's session list.  <br>See [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) for more details on how to obtain the token. <br>**Type:** `string`
| `serverPort`            | *Optional* - The port to use when connecting to the server.<br>**Type:** `number`<br>**Default:** `32400`
| `serverProtocol`        | *Optional* - The protocol to use when connecting to the server. Note: https will work with newer Plex Server versions, however MagicMirror may not be able to connect via https. <br>**Type:** `string`<br>**Default:** `"http"`<br>**Options:** `"http"`, `"https"`
| `updateInterval`        | *Optional* - The number of seconds to wait before requesting an update of the data from the Plex Server. The minimum value is `2`. <br>**Type:** `number`<br>**Default:** `30`
| `fontSize`              | *Optional* - The main font size to use for the module text. <br>**Type:** `string`<br>**Default:** `'medium'`<br>**Options:** `'x-small'`, `'small'`, `'medium'`, `'large'`, `'x-large'`
| `fontColor`             | *Optional* - The colour to use for the module text. <br>**Type:** `string`<br>**Default:** MagicMirror's default color<br>**Options:** Any valid CSS color value.  See [w3schools](https://www.w3schools.com/cssref/css_colors_legal.asp) for more info.
| `userNameFilter`        | *Optional* - Replace usernames with custom names.  i.e. if someone uses the username `plex.user.123`, the module can display their actual name instead by adding an entry into this object that maps the user name to the friendly name.<br>**Example:** `{ "user_name": "Custom Name", "plex.user.123": "John Smith" }`<br>**Type:** `object`<br>**Default:** `{}`
| `showUser`              | *Optional* - When `true`, the user avatar and username are shown for each item in the list.<br>**Type:** `boolean`<br>**Default:** `true`
| `showPoster`            | *Optional* - When `true`, the thubmail image is show for each item in the list with a supported image.<br>**Type:** `boolean`<br>**Default:** `true`
| `showStatusIcons`       | *Optional* - When `true`, the status indicator icons are shown in the list. These icons include the playback state (playing/paused), connection type (local/remote) and connection security status (secure/insecure).<br>**Type:** `boolean`<br>**Default:** `true`
| `networkFilter`         | *Optional* - Whether to show only Local streams, only Remote streams of Both. <br>**Type:** `string`<br>**Default:** `'both'`<br>**Options:** `'local'`, `'remote'`, `'both'`
| `playStateFilter`       | *Optional* - Whether to show only Playing streams, only Paused streams of Both. <br>**Type:** `string`<br>**Default:** `'both'`<br>**Options:** `'playing'`, `'paused'`, `'both'`
| `userWhiteList`         | *Optional* - When set, items will only show up if the user is in this list.<br>**Type:** `array` of `string`<br>**Default:** `[]`
| `userBlackList`         | *Optional* - Items will NOT show up if the user is in this list.  This has a higher priority than `userWhiteList`. <br>**Type:** `array` of `string`<br>**Default:** `[]`
| `typeWhiteList`         | *Optional* - When set, items will only show up if the type is in this list.<br>**Item Types**: `"movie"`, `"episode"`, `"track"`, `"photo"`, `"trailer"`, `"livetv"`, `"other"`.<br>**Type:** `array` of `string`<br>**Default:** `[]`
| `typeBlackList`         | *Optional* - Items will NOT show up if the type is in this list.  This has a higher priority than `typeWhiteList`.  See `typeWhiteList` for the list of Item Types. <br>**Type:** `array` of `string`<br>**Default:** `[]`
| `libraryWhiteList`      | *Optional* - When set, an item will only show up if the name of its Library is in this list.<br>**Item Types**: `"<your_library_names>"`, `"Trailers"`, `"Other"`.<br>**Type:** `array` of `string`<br>**Default:** `[]`
| `libraryBlackList`      | *Optional* - An item will NOT show up if the name of its Library is in this list.  This has a higher priority than `libraryWhiteList`.  See `libraryWhiteList` for the list of Library Names. <br>**Type:** `array` of `string`<br>**Default:** `[]`
| `animationSpeed`        | *Optional* - The number of milliseconds to use for the animation when updating the on-screen display of this module. The minimum value is `0`.<br>**Type:** `number`<br>**Default:** `0`
| `initialLoadDelay`      | *Optional* - The number of seconds to wait before starting to run this module. The minimum value is `0`. <br>**Type:** `number`<br>**Default:** `0`
| `retryDelay`            | *Optional* - The number of seconds to wait before trying to request the data again after a data retrieval failure.<br>**Type:** `number`<br>**Default:** `5`

## Updates
To update the module to the latest version, use your terminal to:
1. Navigate to your MMM-LocalTemperature folder. If you are using the default installation directory, use the command:<br>`cd ~/MagicMirror/modules/MMM-LocalTemperature`
2. Update the module by executing the following command:<br>`git pull`

If you have changed the module on your own, the update will fail. <br>To force an update (WARNING! your changes will be lost), reset the module and then update with the following commands:
```
git reset --hard
git pull
```

## Manually Choose a Version

To use an older version of this module, use your terminal to:
1. Navigate to your MMM-LocalTemperature folder. If you are using the default installation directory, use the command:<br>`cd ~/MagicMirror/modules/MMM-LocalTemperature`
2. Fetch all the available tags<br>`git fetch`
3. Show all the available tags<br>`git tag`
4. Checkout one of the available tags<br>`git checkout {tag_name}`<br>Example: `git checkout v1.0.0`


To switch back to the latest version, use your terminal to:
1. Navigate to your MMM-LocalTemperature folder. If you are using the default installation directory, use the command:<br>`cd ~/MagicMirror/modules/MMM-LocalTemperature`
2. Checkout the master branch<br>`git checkout master`

## License

### The MIT License (MIT)

Copyright © 2019 David Dearden

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

**The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**
