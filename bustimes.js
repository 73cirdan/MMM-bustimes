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
        departuresOnlySuffix: "departures",

        refreshInterval: 5 * 1000 * 60, // refresh every 5 minutes
        timeFormat: "HH:mm",

        destinations: null,

        departures: 3,
        showOnlyDepartures: true,
        showDelay: false,
        showHeader: false,

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

    /*
     * Returns the departure time as a string. Depending on the config, this may
     * either be the time itself, or the scheduled time and the expected offset
     * in minutes.
     */
    getDepartureTime: function(departure) {
        let time = "";
        if (this.config.showDelay) {
            const plannedTime = moment(departure.TargetDepartureTime);
            const liveTime = moment(departure.ExpectedDepartureTime);
            const timeDiff = moment.duration(liveTime.diff(plannedTime));

            // Round down minutes, to be pessimistic for early buses,
            // and optimistic for delayed buses (it's better to arrive
            // early at bus stop, rather than late and miss bus).
            const minutesDiff = Math.abs(Math.floor(timeDiff.asMinutes()));

            // We take the absolute value of minutes and use a bigger
            // (clearer) minus(-like) sign for early departures.
            const sign = liveTime.isBefore(plannedTime) ? "&ndash;" : "+";

            time = plannedTime.format(this.config.timeFormat);
            if (minutesDiff > 0)
                time += sign + minutesDiff;
        } else {
            time = moment(departure.ExpectedDepartureTime).format(this.config.timeFormat);
        }
        return time;
    },

    createEmptyTable: function(className) {
        const table = document.createElement("table");
        table.className = "small thin light";
        if (className)
            table.className += " " + className;
        return table;
    },

    createRow: function(table) {
        const row = document.createElement("tr");
        table.appendChild(row);
        return row;
    },

    createCell: function(row, content, className, cellType = "td") {
        const cell = document.createElement(cellType);
        row.appendChild(cell);
        cell.innerHTML = content;
        if (className)
            cell.className = className;
        return cell;
    },

    /*
     * Create the small table for departures, with a single row per stop,
     * showing the earliest departure from that stop.
     */
    createSmallTable: function(timingPointNames) {
        const table = this.createEmptyTable("ovtable-small");

        for (const timingPointName of timingPointNames) {
            const departure = this.departures[timingPointName][0];

            const row = this.createRow(table);
            this.createCell(row, timingPointName, "stopname");
            this.createCell(row, departure.LinePublicNumber, "line");
            this.createCell(row, this.getDepartureTime(departure), "time");
        }
        return table;
    },

    /*
     * Create the medium table for departures, with two rows per stop, one
     * showing the stop name and the second showing N upcoming departures.
     */
    createMediumTable: function(timingPointNames) {
        const table = this.createEmptyTable("ovtable-medium");

        for (const timingPointName of timingPointNames) {
            const timingPoint = this.departures[timingPointName];

            const stopRow = this.createRow(table);
            const cell = this.createCell(stopRow, timingPointName, "stopname");
            cell.colSpan = 2 * this.config.departs;

            const row = this.createRow(table);
            for (let i = 0; i < this.config.departs && i in timingPoint; i++) {
                const departure = timingPoint[i];

                this.createCell(row, departure.LinePublicNumber, "line");
                this.createCell(row, this.getDepartureTime(departure), "time");
            }
        }
        return table;
    },

    /*
     * Create the large table for departures, with N upcoming departures per
     * stop, each on their own row, including additional information such as the
     * destination.
     */
    createLargeTable: function(timingPointNames) {
        const table = this.createEmptyTable("ovtable-large");

        if (this.config.showHeader) {
            const row = this.createRow(table);
            const cell = this.createCell(row, this.translate("line"), null, "th");
            cell.colSpan = 2;
            this.createCell(row, this.translate("departure"), null, "th");
        }

        for (const timingPointName of timingPointNames) {
            const timingPoint = this.departures[timingPointName];

            const stopRow = this.createRow(table);
            const cell = this.createCell(stopRow, timingPointName, "stopname");
            cell.colSpan = 3;

            for (let i = 0; i < this.config.departs && i in timingPoint; i++) {
                const departure = timingPoint[i];

                const row = this.createRow(table);
                this.createCell(row, departure.LinePublicNumber, "line");
                this.createCell(row, departure.Destination, "destination");
                this.createCell(row, this.getDepartureTime(departure), "time");
            }
        }
        return table;
    },

    /*
     * Returns a DOM object that shows the given message.
     */
    createMessage: function(message) {
        const div = document.createElement("div");
        div.innerHTML = message;
        div.className = "dimmed light small";
        return div;
    },

    /*
     * Constructs the content to be shown for this module. This will either be
     * a message (e.g., an error), or a table corresponding to the display mode.
     */
    createContent: function() {
        if (this.errorMsg)
            return this.createMessage(this.errorMsg);
        if (!this.loaded)
            return this.createMessage(this.translate("LOADING"));

        const timingPointNames = Object.keys(this.departures);
        timingPointNames.sort();

        if (timingPointNames.length == 0)
            return this.createMessage(this.translate("noData"));

        const tableCreators = {
            small: this.createSmallTable,
            medium: this.createMediumTable,
            large: this.createLargeTable,
        };
        return tableCreators[this.config.displaymode].call(this, timingPointNames);
    },

    // Override dom generator.
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "bustimes";
        wrapper.appendChild(this.createContent());
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
                    TargetDepartureTime: pass.TargetDepartureTime,
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
