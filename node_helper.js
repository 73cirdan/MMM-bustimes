'use strict';

/* Magic Mirror
 * Module: MMM-bustimes
 *
 * Adapted for Dutch system by Cirdan
 * Origin by Stefan Krause
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var request = require('request');
var moment = require('moment');

module.exports = NodeHelper.create({

    start: function() {
        this.started = false;
        this.config = null;
    },

    /*
     * Requests new data from openov.nl.
     * Calls processBusTimes on succesfull response.
     */
    getData: function() {
        var self = this;

        var ovUrl = this.config.apiBase + "/" + this.config.tpcEndpoint + "/" + this.config.timepointcode;

        if (self.config.debug)
            console.log(self.name + ": Requesting new data");

        request({
            url: ovUrl,
            method: 'GET',
        }, function(error, response, body) {

            if (!error && response.statusCode == 200) {
                self.sendSocketNotification("DATA", body);
            } else {
                console.log(self.name + ": Could not load timepoint(s) on url:" + ovUrl);
            }
        });

        setTimeout(function() {
            self.getData();
        }, this.config.refreshInterval);
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        if (notification === 'CONFIG' && self.started == false) {
            self.config = payload;
            self.sendSocketNotification("STARTED", true);
            self.getData();
            self.started = true;
        }
    }
});
