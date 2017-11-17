/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone', 'x2js', 'models/formats/ObjectFormat'], 
    function($, _, Backbone, X2JS, ObjectFormat) {

    /*
     * ObjectFormats represents the DataONE object format list
     * found at https://cn.dataone.org/cn/v2/formats, or
     * the Coordinating Node environment configured `AppModel.d1CNBaseUrl`
     * This collection is intended to be used as a formats cache -
     * retrieved once, and only refreshed later if an object format
     * isn't present when needed.
     */
    var ObjectFormats = Backbone.Collection.extend({
        
        model: ObjectFormat,
        
        /* Create a new ObjectFormats collection */
        initialize: function() {
            console.log("ObjectFormats.initialize() called.");
            
        },
        
        /* 
         * The constructed URL of the collection
         * (/cn/v2/formats)
         */
        url: function() {
            
            // no need for authentication token, just the URL
            return MetacatUI.appModel.get("formatsServiceUrl");
            
        },
        
        /* Retrieve the formats from the Coordinating Node */
        fetch: function(options) {
            var fetchOptions = _.extend({dataType: "text"}, options);
            
            return Backbone.Model.prototype.fetch.call(this, fetchOptions);
            
        },
        
        /* Parse the XML response from the CN */
        parse: function(response) {
            console.log("ObjectFormats.parse() called.");
            
            // If the collection is already parsed, just return it
            if ( typeof response === "object" ) return response;
            
            // Otherwise, parse it
            var x2js = new X2JS();
            var formats = x2js.xml_str2json(response);
            
            return formats.objectFormatList.objectFormat;
        }

    });
    
    return ObjectFormats;
});