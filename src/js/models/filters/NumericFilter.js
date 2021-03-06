/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @class NumericFilter
  * @classdesc A search filter whose search term is always an exact number or numbber range
  * @classcategory Models/Filters
  * @extends Filter
  * @constructs
  */
	var NumericFilter = Filter.extend(
    /** @lends NumericFilter.prototype */{

    type: "NumericFilter",

    /**
    * Default attributes for this model
    * @extends Filter#defaults
    * @type {Object}
    * @property {Date}    min - The minimum number to use in the query for this filter
    * @property {Date}    max - The maximum number to use in the query for this filter
    * @property {Date}    rangeMin - The lowest possible number that 'min' can be
    * @property {Date}    rangeMax - The highest possible number that 'max' can be
    * @property {string}  nodeName - The XML node name to use when serializing this model into XML
    * @property {boolean} range - If true, this Filter will use a numeric range as the search tterm instead of an exact number
    * @property {number}  step - The number to increase the search value by when incrementally increasing or decreasing the numeric range
    */
    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        nodeName: "numericFilter",
        min: null,
        max: null,
        rangeMin: null,
        rangeMax: null,
        range: true,
        step: 0
      });
    },

    /**
    * Parses the numericFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the NumericFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      try{
        var modelJSON = Filter.prototype.parse.call(this, xml);

        //Get the rangeMin and rangeMax nodes
        var rangeMinNode = $(xml).find("rangeMin"),
            rangeMaxNode = $(xml).find("rangeMax");

        //Parse the range min
        if( rangeMinNode.length ){
          modelJSON.rangeMin = parseFloat(rangeMinNode[0].textContent);
        }
        //Parse the range max
        if( rangeMaxNode.length ){
          modelJSON.rangeMax = parseFloat(rangeMaxNode[0].textContent);
        }

        //If this Filter is in a filter group, don't parse the values
        if( !this.get("inFilterGroup") ){
          //Get the min, max, and value nodes
          var minNode = $(xml).find("min"),
              maxNode = $(xml).find("max"),
              valueNode = $(xml).find("value");

          //Parse the min value
          if( minNode.length ){
            modelJSON.min = parseFloat(minNode[0].textContent);
          }
          //Parse the max value
          if( maxNode.length ){
            modelJSON.max = parseFloat(maxNode[0].textContent);
          }
          //Parse the value
          if( valueNode.length ){
            modelJSON.values = [parseFloat(valueNode[0].textContent)];
          }
        }
        //If a range min and max was given, or if a min and max value was given,
        // then this NumericFilter should be presented as a numeric range (rather than
       // an exact numeric value).
        if( rangeMinNode.length || rangeMaxNode.length || (minNode.length && maxNode.length) ){
          //Set the range attribute on the JSON
          modelJSON.range = true;
        }
        else{
          //Set the range attribute on the JSON
          modelJSON.range = false;
        }

        //If a range step was given, save it
        if( modelJSON.range ){
          var stepNode = $(xml).find("step");

          if( stepNode.length ){
            //Parse the text content of the node into a float
            modelJSON.step = parseFloat(stepNode[0].textContent);
          }
        }
      }
      catch(e){
        //If an error occured while parsing the XML, return a blank JS object
        //(i.e. this model will just have the default values).
        return {};
      }

      return modelJSON;
    },

    /**
     * Builds a query string that represents this filter.
     *
     * @return {string} The query string to send to Solr
     */
    getQuery: function(){

      //Start the query string
      var queryString = "";

      //Only construct the query if the min or max is different than the default
      if( this.get("min") != this.get("rangeMin") || this.get("max") != this.get("rangeMax") ){

        //Iterate over each filter field and add to the query string
        _.each(this.get("fields"), function(field, i, allFields){

          //Construct a query string for ranges, min, or max
          if(
            this.get("range") ||
            (this.get("max") || this.get("max") === 0) ||
            (this.get("min") || this.get("min") === 0)
          ){

            //Get the minimum and maximum values
            var max = this.get("max"),
                min = this.get("min");

            //If no min or max was set, but there is a value, construct an exact value match query
            if( !min && min !== 0 && !max && max !== 0 &&
                     (this.get("values")[0] || this.get("values")[0] === 0) ){
              queryString += field + ":" + this.get("values")[0];
            }
            //If there is no min or max or value, set an empty query string
            else if( !min && min !== 0 && !max && max !== 0 &&
                     ( !this.get("values")[0] && this.get("values")[0] !== 0) ){
              queryString = "";
            }
            //If there is at least a min or max
            else{
              //If there's a min but no max, set the max to a wildcard (unbounded)
              if( (min || min === 0) && !max ){
                max = "*";
              }
              //If there's a max but no min, set the min to a wildcard (unbounded)
              else if ( !min && min !== 0 && max ){
                min = "*";
              }
              //If the max is higher than the min, set the max to a wildcard (unbounded)
              else if( (max || max === 0) && (min || min === 0) && (max < min) ){
                max = "*";
              }

              //Add the range for this field to the query string
              queryString += field + ":[" + min + "%20TO%20" + max + "]";
            }
          }
          //If there is a value set, construct an exact numeric match query
          else if( this.get("values")[0] || this.get("values")[0] === 0 ){
            console.debug( "~~~If there is a value set, construct an exact numeric match query~~~" );
            queryString += field + ":" + this.get("values")[0];
          }

          //If there is another field, add an operator
          if( allFields[i+1] && queryString.length ){
            queryString += "%20" + this.get("operator") + "%20";
          }

        }, this);

        //If there is more than one field, wrap the query in paranthesis
        if( this.get("fields").length > 1 && queryString.length ){
          queryString = "(" + queryString + ")";
        }

      }
      
      return queryString;

    },

    /**
     * Updates the XML DOM with the new values from the model
     *  @inheritdoc
     *  @return {XMLElement} An updated numericFilter XML element from a portal document
    */
    updateDOM:function(options){

      try{
        if( typeof options == "undefined" ){
          var options = {};
        }

        var objectDOM = Filter.prototype.updateDOM.call(this);

        //Numeric Filters don't use matchSubstring nodes
        $(objectDOM).children("matchSubstring").remove();

        //Get a clone of the original DOM
        var originalDOM;
        if( this.get("objectDOM") ){
          originalDOM = this.get("objectDOM").cloneNode(true);
        }

        // Get new numeric data
        var numericData = {
          min: this.get("min"),
          max: this.get("max")
        };

        if( !options.forCollection ){
          numericData = _.extend(numericData, {
            rangeMin: this.get("rangeMin"),
            rangeMax: this.get("rangeMax"),
            step: this.get("step")
          });
        }

        // Make subnodes and append to DOM
        _.map(numericData, function(value, nodeName){

          if( value || value === 0 ){

            //If this value is the same as the default value, but it wasn't previously serialized,
            if( (value == this.defaults()[nodeName]) &&
                ( !$(originalDOM).children(nodeName).length ||
                  ($(originalDOM).children(nodeName).text() != value + "-01-01T00:00:00Z") )){
                return;
            }

            var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
            $(nodeSerialized).text(value);
            $(objectDOM).append(nodeSerialized);
          }

        }, this);

        //Remove filterOptions for collection definition filters
        if( options.forCollection ){
          $(objectDOM).children("filterOptions").remove();
        }
        else{
          //Make sure the filterOptions are listed last
          //Get the filterOptions element
          var filterOptions = $(objectDOM).children("filterOptions");
          //If the filterOptions exist
          if( filterOptions.length ){
            //Detach from their current position and append to the end
            filterOptions.detach();
            $(objectDOM).append(filterOptions);
          }
        }

        return objectDOM;
      }
      catch(e){
        return "";
      }

    },

    /**
    * Creates a human-readable string that represents the value set on this model
    * @return {string}
    */
    getReadableValue: function(){

      var readableValue = "";

      var min = this.get("min"),
          max = this.get("max"),
          value = this.get("values")[0];

      if( !value && value !== 0 ){
        //If there is a min and max
        if( (min || min === 0) && (max || max === 0) ){
          readableValue = min + " to " + max;
        }
        //If there is only a max
        else if(max || max === 0){
          readableValue = "No more than " + max;
        }
        else{
          readableValue = "At least " + min;
        }
      }
      else{
        readableValue = value;
      }

      return readableValue;

    },

    /**
    * @inheritdoc
    */
    hasChangedValues: function(){

      return (this.get("values").length > 0 ||
              this.get("min") != this.defaults().min ||
              this.get("max") != this.defaults().max);

    },

    /**
    * Checks if the values set on this model are valid and expected
    * @return {object} - Returns a literal object with the invalid attributes and their corresponding error message
    */
    validate: function(){

      //Validate most of the NumericFilter attributes using the parent validate function
      var errors = Filter.prototype.validate.call(this);
      
      //If everything is valid so far, then we have to create a new object to store errors
      if( typeof errors != "object" ){
        errors = {};
      }

      //Delete error messages for the attributes that are going to be validated specially for the NumericFilter
      delete errors.values;
      delete errors.min;
      delete errors.max;
      delete errors.rangeMin;
      delete errors.rangeMax;
      
      //If there is an exact number set as the search term
      if( Array.isArray(this.get("values")) && this.get("values").length ){
        //Check that all the values are numbers
        if(_.find(this.get("values"), function(n){ return typeof n != "number" })){
          errors.values = "All of the search terms for this filter need to be numbers.";
        }
      }
      //If there is a search term set on the model that is not an array, or number,
      // or undefined, or null, then it is some other invalid value like a string or date.
      else if( !Array.isArray(this.get("values")) && typeof values != "number" && typeof values != "undefined" && values !== null){
        errors.values = "The search term for this filter needs to a number.";
      }
      //Check that the min and max values are in order, if the minimum is not the default value of 0
      else if( typeof this.get("min") == "number" && typeof this.get("max") == "number" ){
        if( this.get("min") > this.get("max") && this.get("min") != 0 ){
          errors.min = "The minimum is after the maximum. The minimum must be a number less than the maximum, which is " + this.get("max");
        }
      }
      //If there is only a minimum number specified, check that it is a number
      else if( this.get("min") && typeof this.get("min") != "number"){
        errors.min = "The minimum needs to be a number."
        if( this.get("max") && typeof this.get("max") != "number" ){
          errors.max = "The maximum needs to be a number."
        }
      }
      //Check if the maximum is a value other than a number
      else if( this.get("max") && typeof this.get("max") != "number"){
        errors.max = "The maximum needs to be a number."
      }
      //If there is no min, max, or value, then return an errors
      else if( !this.get("max") && this.get("max") !== 0 && !this.get("min") && this.get("min") !== 0 &&
               ( (!this.get("values") && this.get("values") !== 0) || (Array.isArray(this.get("values")) && !this.get("values").length) )){
        errors.values = "This search filter needs an exact number or a number range to use in the search query."
      }

      //Return the error messages
      if( Object.keys(errors).length ){
        return errors;
      }
      else{
        return;
      }

    }

  });

  return NumericFilter;
});
