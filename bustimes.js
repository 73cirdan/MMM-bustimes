/* global Module */
/* Magic Mirror
 * Module: BusTimes
 *
 * By Cirdan.
 *
 */
Module.register("bustimes", {

    // Default module config.
    defaults: {
        animationSpeed: 1000,

        apiBase: "http://v0.ovapi.nl",
        tpcEndpoint: "tpc",

        refreshInterval: 1000 * 60, // refresh every minute

        debug: false
    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js"];
    },

    // Define required scripts.
    getStyles: function() {
        return ["bustimes.css"];
    },

    // Define required translations.
    getTranslations: function() {
        // The translations for the default modules are defined in the core translation files.
        // Therefor we can just return false. Otherwise we should have returned a dictionary.
        // If you're trying to build yiur own module including translations, check out the documentation.
        return false;
    },

    // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);

        // Set locale.
        moment.locale(config.language);

        this.loaded = false;
        this.sendSocketNotification('CONFIG', this.config);

    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");

        if (!this.loaded) {
            wrapper.innerHTML = this.translate("LOADING");
            wrapper.className = "dimmed light small";
            return wrapper;
        }
        if (!this.departures.length) {
            wrapper.innerHTML = "No data";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        var table = document.createElement("table");
        table.id = "ovtable";
        table.className = "small thin light";

        if (this.config.displaymode === "large") {
            var row = document.createElement("tr");
            var timeHeader = document.createElement("th");
            timeHeader.innerHTML = "Vertrek";
            timeHeader.className = "ovheader";
            row.appendChild(timeHeader);
            var lineHeader = document.createElement("th");
            lineHeader.innerHTML = "Lijn";
            lineHeader.className = "ovheader_r";
            row.appendChild(lineHeader);
            table.appendChild(row);
        }

        var currentTPC = "";
        var numberOfTimes = 0;
        var tpcRow;
        var row = document.createElement("tr");
        for (var i in this.departures) {
            var currentDeparture = this.departures[i];

            // print the TimingPoint only once as a row
            if (currentTPC != currentDeparture.TimingPointName) {
                currentTPC = currentDeparture.TimingPointName;
                if (this.config.debug)
                    Log.info(this.name + ": stop " + currentTPC);
                tpcRow = document.createElement("tr");
                var cellTpc = document.createElement("td");
                cellTpc.innerHTML = currentTPC;
                cellTpc.className = "destinationinfo";
                if (this.config.displaymode === "large") {
                    cellTpc.colSpan = 2;
                } else if (this.config.displaymode === "medium") {
                    cellTpc.colSpan = 2 + 2 * this.config.departs;
                } else {
                    cellTpc.colSpan = 4;
                }
                tpcRow.appendChild(cellTpc);
                table.appendChild(tpcRow);
                numberOfTimes = 0;
            }

            // print only the first three(config) time and line
            if (numberOfTimes < this.config.departs) {
                var time = currentDeparture.ExpectedArrivalTime;
                time = (time).substring((time).indexOf('T') + 1, (time).length);
                if (this.config.debug)
                    Log.info(this.name + ": " + currentDeparture.TransportType.toLowerCase() + " " + currentDeparture.LinePublicNumber + " will arrive at: " + time);

                var cellDeparture = document.createElement("td");
                cellDeparture.innerHTML = time;
                cellDeparture.className = "timeinfo";
                if (this.config.displaymode === "small") {
                    if (numberOfTimes == 0) tpcRow.appendChild(cellDeparture);
                } else {
                    row.appendChild(cellDeparture);
                }

                //var cellTransport = document.createElement("td");
                //cellTransport.className = "timeinfo";
                //var symbolTransportation = document.createElement("span");
                //symbolTransportation.className = this.config.iconTable[currentDeparture.transportation];
                //cellTransport.appendChild(symbolTransportation);
                //row.appendChild(cellTransport);

                var cellLine = document.createElement("td");
                cellLine.innerHTML = currentDeparture.LinePublicNumber;
                cellLine.className = "lineinfo";
                if (this.config.displaymode === "small") {
                    if (numberOfTimes == 0) tpcRow.appendChild(cellLine);
                } else {
                    row.appendChild(cellLine);
                }

                table.appendChild(row);
                if ((this.config.displaymode === "large") ||
                    (this.config.departs == numberOfTimes + 1)) {
                    row = document.createElement("tr");
                    }
            }
            numberOfTimes++;

        }
        wrapper.appendChild(table);

        return wrapper;
    },

    /*
     * sort the results 1st on tpc, than by date-time
     */
    sortDepartures: function(tpc, time) {

        // sort on a String in a array of object like : [(String1, String2, String3, ..)]
        function dynamicSort(property) {
            var sortOrder = 1;
            if (property[0] === "-") {
                sortOrder = -1;
                property = property.substr(1);
            }
            return function(a, b) {
                var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                return result * sortOrder;
            }
        }
        // sort on a set of string in an array of objects like: [(Sring1, String2, String3, ..)]
        function dynamicSortMultiple() {
            /*
             * save the arguments object as it will be overwritten
             * note that arguments object is an array-like object
             * consisting of the names of the properties to sort by
             */
            var props = arguments;
            return function(obj1, obj2) {
                var i = 0,
                result = 0,
                numberOfProperties = props.length;
                /* try getting a different result from 0 (equal)
                 * as long as we have extra properties to compare
                 */
                while (result === 0 && i < numberOfProperties) {
                    result = dynamicSort(props[i])(obj1, obj2);
                    i++;
                }
                return result;
            }
        }

        // sort on busstop(timingpoint), and time.
        this.departures.sort(dynamicSortMultiple(tpc, time));
    },

    /* processBusTimes(data)
     * Uses the received data to set the various values.
     *
     * argument data object - busstop information received form openapi
     */
    processBusTimes: function(data) {

        if (!data) {
            // Did not receive usable new data.
            // Maybe this needs a better check?
            Log.error(self.name + ": Could not parse bus times.");
            return;
        }

        if (this.config.debug)
            Log.info(this.name + ": Received data");

        var msg = JSON.parse(data); // converts it to a JS native object.

        this.departures = []; // our object for the Dom
        for (var i in msg) {
            var tpc = msg[i];
            for (var j in tpc) {
                // only interested in passes (ignoring stop and messages)
                var passes = tpc[j];
                if (j == "Passes") {
                    for (var k in passes) {
                        var bus = passes[k];
                        this.departures.push({
                            ExpectedArrivalTime: bus.ExpectedArrivalTime,
                            TransportType: bus.TransportType,
                            LinePublicNumber: bus.LinePublicNumber,
                            TimingPointName: bus.TimingPointName,
                        });
                    }
                }
            }
        }

        this.sortDepartures("TimingPointName", "ExpectedArrivalTime");

        this.loaded = true;
        this.updateDom(this.config.animationSpeed);
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "STARTED") {
            this.updateDom();
        } else if (notification === "DATA") {
            this.loaded = true;
            this.processBusTimes(payload);
        }
    }


});
