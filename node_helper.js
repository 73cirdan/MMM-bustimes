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
        this.running = false;
        this.config = null;
    },

    /*
     * Requests new data from openov.nl.
     * Calls processBusTimes on succesfull response.
     */
    getData: function() {
        var self = this;
        var ovUrl = this.config.apiBase + "/" + this.config.tpcEndpoint + "/" + this.config.timingPointCode;

        request({
            url: ovUrl,
            method: 'GET',
        }, function(error, response, body) {
            self.running = false;
            if (!error && response.statusCode == 200) {
                self.sendSocketNotification("RESPONSE", body);
            } else {
                console.log(self.name + ": Could not load timingpoint(s) on url:" + ovUrl);
            }
        });
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === 'GETDATA' && this.running == false) {
            this.running = true;
            this.config = payload;
            this.getData();
        }
    }
});
