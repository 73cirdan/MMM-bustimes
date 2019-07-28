/* global Module */
/* Magic Mirror
 * Module: BusTimes
 *
 * By Cirdan.
 *
 */
Module.register("bustimes", {

    scheduledTimer: -1,

    // Default module config.
    defaults: {
        animationSpeed: 1000,

        apiBase: "http://v0.ovapi.nl",
        tpcEndpoint: "tpc",

        refreshInterval: 5 * 1000 * 60, // refresh every 5 minutes
        timeFormat: "HH:mm",

        destinations: null,

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
        return {
            en: "translations/en.json",
            nl: "translations/nl.json",
            it: "translations/it.json",
        };
    },

    // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);

        // Set locale.
        moment.locale(config.language);

        this.errorMsg = "";
        this.departures = {};

        if (!Array.isArray(this.config.destinations)) {
            this.config.destinations = [];
        }

        // Preserve backwards compatibly
        if (this.config.timingPointCode === undefined && this.config.timepointcode) {
            this.config.timingPointCode = this.config.timepointcode;
            this.config.timepointcode = undefined;
        }

        if (!this.config.timingPointCode) {
            this.errorMsg = this.translate("notSet");
            this.updateDom();
            return;
        }

        if (!["small", "medium", "large"].includes(this.config.displaymode)) {
            this.errorMsg = this.translate("invalDisplayMode");
            this.updateDom();
            return;
        }

        this.resume();
        this.requestData();
    },

    /* suspend()
     * Disable refreshing.
     */
    suspend: function() {
        if (this.scheduledTimer != -1) {
            if (this.config.debug)
                Log.info(this.name + ": Canceling updates");
            clearInterval(scheduledTimer);
            this.scheduledTimer = -1;
        }
    },

    /* resume()
     * Enable automatic refreshing.
     */
    resume: function() {
        if (this.scheduledTimer == -1) {
            if (this.config.debug)
                Log.info(this.name + ": Scheduling updates");
            var self = this;
            this.scheduledTimer = setInterval(function() {
                self.requestData();
            }, this.config.refreshInterval);
        }
    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");

        if (this.errorMsg) {
            wrapper.innerHTML = this.errorMsg;
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (!this.loaded) {
            wrapper.innerHTML = this.translate("LOADING");
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        const timingPointNames = Object.keys(this.departures);
        timingPointNames.sort();

        if (timingPointNames.length == 0) {
            wrapper.innerHTML = this.translate("noData");
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        var table = document.createElement("table");
        table.id = "ovtable";
        table.className = "small thin light";

        if (this.config.displaymode === "large") {
            var row = document.createElement("tr");
            var lineHeader = document.createElement("th");
            lineHeader.innerHTML = this.translate("line");
            lineHeader.className = "ovheader_r";
            row.appendChild(lineHeader);
            var timeHeader = document.createElement("th");
            timeHeader.innerHTML = this.translate("departure");
            timeHeader.className = "ovheader";
            row.appendChild(timeHeader);
            table.appendChild(row);
        }

        for (const timingPointName of timingPointNames) {
            const timingPoint = this.departures[timingPointName];

            if (this.config.debug)
                Log.info(this.name + ": stop " + timingPointName);
            var tpcRow = document.createElement("tr");
            var cellTpc = document.createElement("td");
            cellTpc.innerHTML = timingPointName;
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

            var row = document.createElement("tr");
            for (var i in timingPoint) {
                var departure = timingPoint[i];

                if (i == this.config.departs)
                    break;

                const time = moment(departure.ExpectedDepartureTime).format(this.config.timeFormat);

                if (this.config.debug)
                    Log.info(this.name + ": " + departure.TransportType.toLowerCase() + " " + departure.LinePublicNumber + " will arrive at: " + time);

                var cellLine = document.createElement("td");
                cellLine.innerHTML = departure.LinePublicNumber;
                if (departure.Destination != null && this.config.showDestination ) {
                    cellLine.innerHTML += " (" + departure.Destination + ")";
                }
                cellLine.className = "lineinfo";
                if (this.config.displaymode === "small") {
                    if (i == 0) tpcRow.appendChild(cellLine);
                } else {
                    row.appendChild(cellLine);
                }

                var cellDeparture = document.createElement("td");
                cellDeparture.innerHTML = time;
                cellDeparture.className = "timeinfo";
                if (this.config.displaymode === "small") {
                    if (i == 0) tpcRow.appendChild(cellDeparture);
                } else {
                    row.appendChild(cellDeparture);
                }

                //var cellTransport = document.createElement("td");
                //cellTransport.className = "timeinfo";
                //var symbolTransportation = document.createElement("span");
                //symbolTransportation.className = this.config.iconTable[currentDeparture.transportation];
                //cellTransport.appendChild(symbolTransportation);
                //row.appendChild(cellTransport);


                table.appendChild(row);
                if ((this.config.displaymode === "large") ||
                    (this.config.departs == i + 1)) {
                    row = document.createElement("tr");
                }
            }

        }
        wrapper.appendChild(table);

        return wrapper;
    },

    /* processBusTimes(data)
     * Uses the received data to set the various values.
     *
     * argument data object - bus stop information received from OVapi
     */
    processBusTimes: function(data) {

        if (!data) {
            // Did not receive usable new data.
            // Maybe this needs a better check?
            Log.error(self.name + ": Could not parse bus times.");
            this.errorMsg = this.translate("error");
            return;
        }

        if (this.config.debug)
            Log.info(this.name + ": Received data");

        const msg = JSON.parse(data); // converts it to a JS native object.

        // Data that will be used by DOM - passes per timing point (aggregated
        // by name, not tpc).
        this.departures = {}

        // Go over results for each requested tpc (e.g., bus stop). For each tpc
        // we get info about the stop itself, and all the passes (i.e.,
        // arrivals/departures of vehicles).
        for (const {Stop, Passes} of Object.values(msg)) {
            const timingPointName = Stop.TimingPointName;
            if (!this.departures[timingPointName])
                this.departures[timingPointName] = [];

            for (const pass of Object.values(Passes)) {
                const destination = pass.DestinationName50 || "?";

                if (this.config.destinations.length > 0 &&
                    !this.config.destinations.includes(pass.DestinationCode)) {
                    if (this.config.debug)
                        Log.info(this.name + ": Skipped line (number " + pass.LinePublicNumber + ") "
                        + " with destination " + pass.DestinationCode + " (" + destination + ")");
                    continue;
                }

                this.departures[timingPointName].push({
                    ExpectedDepartureTime: pass.ExpectedDepartureTime,
                    TransportType: pass.TransportType,
                    LinePublicNumber: pass.LinePublicNumber,
                    TimingPointName: pass.TimingPointName,
                    Destination: destination,
                });
            }
        }

        // Sort departures by time, per timingpoint.
        for (const tp in this.departures)
            this.departures[tp].sort(
                (obj1, obj2) => obj1["ExpectedDepartureTime"].localeCompare(
                    obj2["ExpectedDepartureTime"]));

        this.loaded = true;
        this.errorMsg = "";
        this.updateDom(this.config.animationSpeed);
    },

    /*
     * Asks the node helper to request new data.
     */
    requestData: function() {
        this.updateDom();

        if (this.config.debug)
            Log.info(this.name + ": Requested data");

        this.sendSocketNotification('GETDATA', {
            identifier: this.identifier,
            config: this.config
        });
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "DATA" && payload.identifier === this.identifier)
            this.processBusTimes(payload.data);
        if (notification === "ERROR" && payload.identifier === this.identifier) {
            if (this.config.debug)
                Log.warn(this.name + ": Error fetching departures: " + payload.error);
            this.errorMsg = this.translate("error");
            this.updateDom(this.config.animationSpeed);
        }
    }

});
