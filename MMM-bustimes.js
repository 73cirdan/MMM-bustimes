/* global Module */
/* Magic Mirror
 * Module: BusTimes
 *
 * By Cirdan.
 *
 */
Module.register("MMM-bustimes", {

    scheduledTimer: -1,

    // Default module config.
    defaults: {
        animationSpeed: 1000,

        apiBase: "http://v0.ovapi.nl",
        timingPointEndpoint: "tpc",
        stopAreaEndpoint: "stopareacode",
        departuresOnlySuffix: "departures",

        refreshInterval: 5 * 1000 * 60, // refresh every 5 minutes
        timeFormat: "HH:mm",

        destinations: null,

        departures: 3,
        showTownName: false,
        showOnlyDepartures: true,
        showDelay: false,
        showHeader: false,
        alwaysShowStopName: true,
        showTimingPointIcon: false,
        showTransportTypeIcon: false,
        showLiveIcon: false,

        transportTypeIcons: {
            "BUS": "bus",
            "TRAM": "train",
            "METRO": "subway",
            "BOAT": "ship",
            "SIGN": "sign",
            "default": "question-circle"
        },

	timingpointTypeIcons: {
            "WHEELCHAIR": "wheelchair",
            "VISUAL": "blind",
            "UNIVERSAL": "universal-access",
            "default": "sign"
	},

        debug: false
    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js"];
    },

    // Define required scripts.
    getStyles: function() {
        return ["MMM-bustimes.css", "font-awesome.css"];
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

        if (!this.config.timingPointCode && !this.config.stopAreaCode) {
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
        if (content)
            cell.innerHTML = content;
        if (className)
            cell.className = className;
        return cell;
    },

    createIcon: function(iconName) {
        const icon = document.createElement("span");
        icon.className = "fa fa-" + iconName;
        return icon;
    },

    createTransportTypeIconCell: function(row, transportType) {
        const iconName = this.config.transportTypeIcons[transportType] ||
                       this.config.transportTypeIcons["default"];
        const icon = this.createIcon(iconName);
        const cell = this.createCell(row, null, "transporttype");
        cell.appendChild(icon);
        return cell
    },

    createTimingPointTypeIconCell: function(row, timingPointType) {
        const iconName = this.config.timingpointTypeIcons[timingPointType] ||
                       this.config.timingpointTypeIcons["default"];
        const icon = this.createIcon(iconName);
        const cell = this.createCell(row, null, "timingpointtype");
        cell.appendChild(icon);
        return cell
    },

    /*
     * Create an icon representing the shown info is live if the info has been
     * updated in the last 10 minutes.
     */
    createLiveIcon: function(container, lastUpdateTimeStamp) {
        const lastUpdate = moment(lastUpdateTimeStamp);
        const now = moment();
        const timeSinceLastUpdate = moment.duration(now.diff(lastUpdate));
        if (timeSinceLastUpdate.asMinutes() < 10) {
            const icon = this.createIcon("wifi");
            icon.className += " liveicon";
            container.appendChild(icon);
        }
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
            if (this.config.showTimingPointIcon)
                this.createTimingPointTypeIconCell(row, "default");
            const stop = this.createCell(row, timingPointName, "stopname");
            if (this.config.showTransportTypeIcon)
                this.createTransportTypeIconCell(row, departure.TransportType);
            this.createCell(row, departure.LinePublicNumber, "line");
            this.createCell(row, this.getDepartureTime(departure), "time");

            if (this.config.showLiveIcon)
                this.createLiveIcon(stop, departure.LastUpdateTimeStamp);
        }
        return table;
    },

    /*
     * Create the medium table for departures, with two rows per stop, one
     * showing the stop name and the second showing N upcoming departures.
     */
    createMediumTable: function(timingPointNames) {
        const table = this.createEmptyTable("ovtable-medium");

        const extraCols = this.config.showTransportTypeIcon ? 1 : 0;
        const extraSpace =  this.config.showTimingPointIcon ? "\u00A0" : "";

        for (const timingPointName of timingPointNames) {
            const timingPoint = this.departures[timingPointName];

            if (this.config.alwaysShowStopName || timingPointNames.length > 1) {
                const stopRow = this.createRow(table);
                if (this.config.showTimingPointIcon)
                    this.createTimingPointTypeIconCell(stopRow, "default");
                const cell = this.createCell(stopRow, extraSpace + timingPointName, "stopname");
                cell.colSpan = (2 + extraCols) * this.config.departs;
            }

            const row = this.createRow(table);
            for (let i = 0; i < this.config.departs && i in timingPoint; i++) {
                const departure = timingPoint[i];

                if (this.config.showTransportTypeIcon)
                    this.createTransportTypeIconCell(row, departure.TransportType);
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

        const extraCols = this.config.showTransportTypeIcon ? 1 : 0;

        if (this.config.showHeader) {
            const row = this.createRow(table);
            const cell = this.createCell(row, this.translate("line"), null, "th");
            cell.colSpan = 2 + extraCols;
            this.createCell(row, this.translate("departure"), null, "th");
        }

        for (const timingPointName of timingPointNames) {
            const timingPoint = this.departures[timingPointName];

            if (this.config.alwaysShowStopName || timingPointNames.length > 1) {
                const stopRow = this.createRow(table);
                if (this.config.showTimingPointIcon)
                    this.createTimingPointTypeIconCell(stopRow, "default");
                const cell = this.createCell(stopRow, timingPointName, "stopname");
                cell.colSpan = 3 + extraCols;
            }

            for (let i = 0; i < this.config.departs && i in timingPoint; i++) {
                const departure = timingPoint[i];

                const row = this.createRow(table);
                if (this.config.showTransportTypeIcon)
                    this.createTransportTypeIconCell(row, departure.TransportType);
                const line = this.createCell(row, departure.LinePublicNumber, "line");
                const dest = this.createCell(row, departure.Destination, "destination");
                const time = this.createCell(row, this.getDepartureTime(departure), "time");

                if (this.config.showLiveIcon)
                    this.createLiveIcon(dest, departure.LastUpdateTimeStamp);
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

    /*
     * Asks the node helper to request new data.
     */
    requestData: function() {
        if (this.config.debug)
            Log.info(this.name + ": Requested data");

        this.sendSocketNotification('GETDATA', {
            identifier: this.identifier,
            config: this.config
        });
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "DATA" && payload.identifier === this.identifier) {
            this.departures = payload.data;
            this.loaded = true;
            this.errorMsg = "";
            this.updateDom(this.config.animationSpeed);
        }

        if (notification === "ERROR" && payload.identifier === this.identifier) {
            if (this.config.debug)
                Log.warn(this.name + ": Error fetching departures: " + payload.error);
            this.errorMsg = this.translate("error");
            this.updateDom(this.config.animationSpeed);
        }
    }

});
