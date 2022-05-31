# MMM-bustimes
Magic Mirror - Dutch bus times

Shows departures of buses, trams, metro's and ferries for any stop in the Netherlands.
Based on data from OVapi, a public API for Dutch public transport information.
For train departures you can use the
[MMM-nstreinen](https://github.com/qistoph/MMM-nstreinen/) module instead (this
includes trains operated by Arriva, CXX, etc.).

The module supports three different display modes, as shown in screenshot below.
![Example screenshot](https://github.com/73cirdan/MMM-bustimes/blob/master/screenshot.png)

Specifically, these display modes are:
 - *small* - Only show a single departure per stop.
 - *medium* - One stop per row, with multiple departures per row.
 - *large* - One departure per row (number of rows configurable).

The module instances on the right in the screenshot show some optional
additional display options. Please see the list of supported configuration
options below for all available options.


# Installation
Navigate into your MagicMirror's `modules` folder and execute

`git clone https://github.com/73cirdan/MMM-bustimes`


After that go into the `MMM-bustimes` folder and execute


`npm install` 

*Note:* After releasing MMM-bustimes, there were some forks made and updated with new options and some bugfixes. These were merged into MMM-bustimes in june 2022. The module now is named `MMM-bustimes` to reflect MM naming convention and uses `axios` in stead of the deprecated `request` module. 

# Update

`git pull` and `npm install` 


Be sure to change the module name in config.js into `MMM-bustimes` !!
And check the names of the config options, because some of them have changed due to consistency.


# Using the module

## Get your TimingPointCode or StopAreaCode

This module can show one or more bus stops in your neighbourhood, which are
represented by a "TimingPoint" code (tpc) or "StopArea" code. A TimingPoint is
a single stop on for example a bus or metro line. Note that a TimingPoint is
just a single platform or quay. Stations and other hubs often have many
TimingPoints. Even two bus stops on opposite sides of a street will be separate
TimingPoints (despite both having the same name). A "StopArea" groups multiple
TimingPoints together into logical clusters (e.g., stops on both sides of
a street, or a station). This module supports both.
More information can be found on the
[OVapi wiki](https://github.com/skywave/KV78Turbo-OVAPI/wiki).

1. Open `http://v0.ovapi.nl/line/` in a browser to find your line in the list of
   all lines.  You can find your line in the result by searching for a city,
   line number, or start/end points. Note that most lines will have two entries:
   one for each direction buses run in.<br>
   *For example, the first line in the resulting JSON was `ARR_28167_2`: Arriva
   line 7911 from Stiens to Alde Leie.*

2. Open `http://v0.ovapi.nl/line/[lineid]` in a browser to check your result
   (e.g., if it is the correct direction), and to find the line stops.  Replace
   the `[lineid]` part in the URL with the ID you found in step one (often in
   the form of `<operator>_<linenr>_<direction>`). Then look through the stops
   for the one you want to use, and write down the `TimingPointCode` or
   `StopAreaCode`.<br>
   *Based on the example in step one: at `http://v0.ovapi.nl/line/ARR_28167_2`
   we find `"TimingPointName":"Alde Leie,Brug","TimingPointCode":"20320110","StopAreaCode":"OliBru"`.*

3. Check the result, depending on whether you choose to use a TimingPoint or
   StopArea:
   - **TimingPointCode:** Check `http://v0.ovapi.nl/tpc/[tpc]`, where `[tpc]` is
     the TimingPointCode you found in step 2. Mind the change from *line* to
     *tpc* in the URL. The passes part of the result should contain buses,
     trams or boats stopping at this stop. All lines terminating at this stop
     are included. If all looks good, copy the tpc into the config.<br>
     *Based on the example in step two, we get `http://v0.ovapi.nl/tpc/20320110`.*
   - **StopAreaCode:** Check `http://v0.ovapi.nl/stopareacode/[sac]`, where
     `[sac]` is the StopAreaCode you found in step 2. Mind the change from
     *line* to *stopareacode* in the URL. The passes part of the result
     should contain buses, trams or boats stopping at this stop. All lines
     terminating at this stop are included. If all looks good, copy the sac into
     the config.<br>
     *Based on the example in step two, we get `http://v0.ovapi.nl/stopareacode/OliBru`.*

## Config options

Option | Description
------ | -----------
`timingPointCode` | One or more TimingPointCodes. Use a comma separated list (`"code1,code2"`) if you need more than one departure list. When `stopAreaCode` is also set, results are combined.<br>**At least one of `timingPointCode` or `stopAreaCode` is required**
`stopAreaCode` | One or more StopAreaCodes. Use a comma separated list (`"code1,code2"`) if you need more than one departure list. When `timingPointCode` is also set, results are combined.<br>**At least one of `timingPointCode` or `stopAreaCode` is required**
`displaymode` | Layout of the module; see above for example and explanation.<br>*Possible values:* `"small"`, `"medium"`, `"large"`<br>**Required**
`departures` | How many departures are shown per stop (not used in *small* mode).<br>*Default value:* `3`
`destinations` | An array with a every destination you care about. Only lines going to any of these destinations will be shown. Valid codes can be found in step 3, under the entry `DestinationCode` of each line.<br>*Default value:* `[]`
`showTownName` | Include the town's name in the stop's name. This is especially useful for stops in small villages, e.g., "Alde Leie, Brug" instead of just "Brug".<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showOnlyDepartures` | Only show departures from stops. This filters out lines that terminate at a stop, and thus do not let people get in the vehicle.<br>*Possible values:* `true` or `false`<br>*Default value:* `true`
`showDelay` | Show departure times as scheduled times and an offset in case of a delay (or early departure). E.g., display "14:57+5" instead of "15:02".<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showTransportTypeIcon` | Show an icon representing the transport type (bus, ferry, metro or tram) next to departures.<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showTimingPointIcon` | Show an icon representing a modern electronic sign used at timingpoints.<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showOperator` | Display the name of the line operator.<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showAccessible` | Show an icon representing the timingpoint and line accessibility features: wheelchair, visual or both.<br>Icons will be displayed with for the timingpoint only if the timingpoint name is also displayed (see AlwaysShowStopName).<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showLiveIcon` | Show an icon representing whether the current displayed time is live (i.e., it has been updated in the last 10 minutes).<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`showHeader` | Show a header with column names for the *large* display mode.<br>*Possible values:* `true` or `false`<br>*Default value:* `false`
`alwaysShowStopName` | When this is set to `false` the name of the stop will be hidden when the module is only displaying data for a single stop in the *medium* or *large* display mode.<br>*Possible values:* `true` or `false`<br>*Default value:* `true`
`timeFormat` | Format of departure times shown. E.g., `"HH:mm:ss"` will include seconds.<br>*Possible values:* any [Moment.js format string](https://momentjs.com/docs/#/displaying/format/)<br>*Default value:* `"HH:mm"`

## Example config.js content for this module
```javascript
    {
        module: "MMM-bustimes",
        position: "top_left",
        header: "Bustimes",
        config: {
            timingPointCode: "20320110,20141200",
            displaymode: "medium",
            showTownName: true,
            departures: 3
        }
    },
```

# Special Thanks
Thanks to contributors [hervidero](https://github.com/hervidero), [hansterwal](https://github.com/hansterwal), [koenk](https://github.com/koenk) and [vpilo](https://github.com/vpilo)  for making this a better module !!! 

The MIT License (MIT)
=====================
Copyright 2017 Cirdan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. **The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**

