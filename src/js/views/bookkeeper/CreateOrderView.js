define(["jquery",
    "underscore",
    "backbone",
    "collections/bookkeeper/Products",
    "models/bookkeeper/Customer",
    "models/bookkeeper/Order",
    "text!templates/bookkeeper/createOrder.html",
    "text!templates/bookkeeper/chooseProduct.html"],
    function($, _, Backbone, Products, Customer, Order, Template, ProductsTemplate){

    /**
    * @class CreateOrderView
    * @classdesc A form that allows the user to create a DataONE Plus Order
    * @extends Backbone.View
    */
    var CreateOrderView = Backbone.View.extend(
      /** @lends CreateOrderView.prototype */ {

      className: "create-order-view",

      tagName: "div",

      template: _.template(Template),

      /**
      * The template that displays the list of available products
      * @type {UnderscoreTemplate}
      */
      productsTemplate: _.template(ProductsTemplate),

      /**
      * The Customer model for this person
      * @type {Customer}
      */
      customer: null,

      /**
      * The Order model that is being created
      * @type {Order}
      */
      order: null,

      /**
      * The user-facing name of an Order. This is a copy of {@link AppConfig#dataonePlusGeneralName}
      * @type {string}
      */
      orderGeneralName: MetacatUI.appModel.get("dataonePlusGeneralName"),

      events: {
        "click .save"   : "processForm",
        "keydown input" : "removeValidation",
        "click .choose-product" : "chooseProduct"
      },

      render: function(){

        //Create a new Customer based on the user's info
        this.customer = new Customer();
        this.customer.copyFromUser(MetacatUI.appUserModel);

        //Create a Products collection and save it to the AppModel
        this.products = new Products();
        MetacatUI.appModel.set("dataonePlusProducts", this.products);

        //Render the Product selection
        this.listenToOnce(this.products, "sync", this.renderProducts);

        //Fetch the Products from Bookkeeper
        this.products.fetch({reset: true});
      },

      /**
      * Renders a form that asks the user for Order information
      */
      renderCreateOrderForm: function(){

        //Show a Customer form
        this.$el.html(this.template(Object.assign({
          orderGeneralName: this.orderGeneralName,
          orderName: this.customer.get("givenName") + "'s " + this.orderGeneralName
        }, this.customer.toJSON())));

      },

      /**
      * Renders a selection of Products for the user to choose from
      */
      renderProducts: function(){

        var collaborator = this.products.findWhere({ name: "Individual", active: true }),
            team = this.products.findWhere({ name: "team", active: true }),
            institution = this.products.findWhere({ name: "institution", active: true });

        this.$el.html( this.productsTemplate({
          collaborator: collaborator? collaborator.toJSON() : null,
          team: team? team.toJSON() : null,
          institution: institution? institution.toJSON() : null
        }) );

      },

      /**
      * Takes the product selected by the user and continues to the next stage of the sign up form
      * @param {Event} event - The event by the user that selected a product
      */
      chooseProduct: function(event){

        try{
          if( !event ){
            return false;
          }

          var productId = $(event.target).data("product-id");

          //Silently fail if no product ID was found
          if( !productId ){
            return false;
          }

          //Find the Product model that was selected
          var chosenProduct = this.products.findWhere({ id: productId });
          this.chosenProduct = chosenProduct;

          //Silently fail if no product was found
          if( !chosenProduct ){
            return false;
          }

          //Now fetch the Customer model for this user
          //When the Customer is fetched, show the Create Order form
          this.listenToOnce(this.customer, "sync notFound", this.renderCreateOrderForm);

          //Fetch the DataONE Customer for the user
          this.customer.fetch();

        }
        catch(e){
          console.error("Caught exception while choosing product: ", e);
        }
      },

      /**
      * Takes the input from the form and validates it
      */
      processForm: function(){

        try{
          if( this.customer.isNew() ){
            var isError   = false,
                firstName = this.$("#inputFirstName").val(),
                lastName  = this.$("#inputLastName").val(),
                email     = this.$("#inputEmail").val();

            if( !firstName || typeof firstName != "string" ){
              this.$("#inputFirstName").parents(".control-group").first().addClass("error")
                  .find(".help-inline").text("Please provide your first name.");
              isError = true;
            }
            if( !lastName || typeof lastName != "string" ){
              this.$("#inputLastName").parents(".control-group").first().addClass("error")
                  .find(".help-inline").text("Please provide your last name.");
              isError = true;
            }
            if( !email || typeof email != "string" ){
              this.$("#inputEmail").parents(".control-group").first().addClass("error")
                  .find(".help-inline").text("Please provide your email.");
              isError = true;
            }

            //If there was a validation error, exit this function
            if( isError ){
              return;
            }

            //Update the Customer with the values from the form
            this.customer.set({
              givenName: firstName,
              surName: lastName,
              email: email
            });

            this.saveCustomer();
          }
          else{
            this.createOrder();
          }

          //Disable the Submit button
          this.$("button.save").text("Submitting...").attr("disabled", "disabled").addClass("disabled");

        }
        catch(e){
          console.error("Error while processing CreateOrder form: ", e);
          this.showOrderSaveError();
        }

      },

      /**
      * Saves the Customer model and triggers createOrder() when the Customer is saved.
      */
      saveCustomer: function(){

        try{
          //When the Customer fails to save, show an error
          this.listenToOnce(this.customer, "error", this.showCustomerSaveError);

          //When the Customer has been successfully saved, create an Order model
          this.listenToOnce(this.customer, "sync", this.createOrder);

          //Save the Customer model to the server
          this.customer.save();
        }
        catch(e){
          console.error("Error while trying to save the create customer form: ", e);
        }
      },

      /**
      * Creates an Order model and saves it to Bookkeeper
      */
      createOrder: function(){

        try{

          //If the Customer was not successfully saved to the server and given an ID
          if( !this.customer || this.customer.isNew() ){
            //Then show an error message and exit
            this.showCustomerSaveError();
            return;
          }

          //Get the Order name from the form
          var orderName = this.$("#inputOrderName").val();
          if( !orderName || typeof orderName != "string" ){
            this.$("#inputOrderName").parents(".control-group").first().addClass("error")
                .find(".help-inline").text("Please provide a name for your " + this.orderGeneralName + ".");
            return;
          }

          //Create an Order model
          this.order = new Order({
            customer: this.customer.get("id"),
            status: "trialing",
            name: orderName,
            amount: 0
          });

          //Get the Order items that were selected
          //This is hard-coded for now
          this.order.addProduct(this.chosenProduct);

          //Create a UserGroup for the Order
          this.order.createOrderGroup();

          //When the UserGroup is set, save it
          this.listenToOnce(this.order, "change:orderGroup", function(){
            var userGroup = this.order.get("orderGroup");

            //If the UserGroup wasn't created for some reason, show an error and exit
            if( !userGroup ){
              this.showOrderSaveError();
              return;
            }

            //When the UserGroup is saved, save the Order
            this.listenToOnce(userGroup, "sync",  this.saveOrder);
            this.listenToOnce(userGroup, "error", function(){

              //If the UserGroup fails to save, it is probably because the groupId is already taken,
              // so try again

              this.listenToOnce(this.order, "change:orderGroup", function(){
                //When the UserGroup is saved, save the Order
                this.listenToOnce(userGroup, "sync", this.saveOrder);

                //Save the UserGroup
                this.order.get("orderGroup").save();
              });

              //Create a UserGroup for the Order
              this.order.createOrderGroup();

            });

            //Save the UserGroup
            userGroup.save();
          });

        }
        catch(e){
          MetacatUI.appModel.logError("Failed to create the Order model: " + e.message, true);
          console.error("Caught exception while creating Order: ", e);
        }

      },

      /**
      * Saves the Order model and listens to save successes and errors
      */
      saveOrder:  function(){
        //When the Order is successfully saved, confirm that the Order is paid
        this.listenToOnce(this.order, "sync", this.payOrder);
        //If the Order fails to save, show the error message
        this.listenToOnce(this.order, "error", this.showOrderSaveError);

        //Save the order to Bookkeeper
        this.order.save();
      },

      /**
      * Confirms that the Order is paid
      */
      payOrder: function(){

        try{

          //Only proceed if the Order was successfully created
          if( !this.order || this.order.isNew() ){
            this.showOrderSaveError();
            return;
          }

          this.listenToOnce(this.order, "payError",   this.showOrderSaveError);
          this.listenToOnce(this.order, "paySuccess", this.showPaySuccess);

          //Confirm the Order payment
          this.order.pay();

        }
        catch(e){
          console.error("Failed to save while paying an Order: ", e);
        }

      },

      /**
      * Removes the validation error messaging from the form
      * @param {Event} [e] - An Event that triggered this callback function
      */
      removeValidation: function(e){
        try{
          //Remove the error messaging from the given form element
          if(e){
            $(e.target).parents(".control-group").first().removeClass("error")
              .find(".help-inline").text("");
          }
          //Remove the error messaging everywhere in the view
          else{
            this.$(".error").removeClass("error");
            this.$(".help-inline").text("");
          }
        }
        catch(error){
          console.warn("Couldn't remove the validation: ", error);
        }
      },

      /**
      * When a Customer fails to save, this function is called to display an error message to the user
      */
      showCustomerSaveError: function(){
        try{

          MetacatUI.appView.showAlert({
            message: this.customer.get("errorMessage") || "Something went wrong while creating a " + this.orderGeneralName + ".",
            classes: "error alert-error",
            container: this.el,
            replaceContents: false,
            remove: true,
            includeEmail: true
          });

          //Remove the listener to the sync event for the Customer
          this.stopListening(this.customer, "sync", this.createOrder);

        }
        catch(e){
          console.error("Failed to save while creating a customer: ", e);
        }
      },

      /**
      * When an Order fails to save, this function is called to display an error message to the user
      */
      showOrderSaveError: function(){
        try{

          MetacatUI.appView.showAlert({
            message: "Something went wrong while creating a " + this.orderGeneralName + ".",
            advancedMessage: this.order.get("errorMessage"),
            classes: "error alert-error",
            container: this.el,
            replaceContents: false,
            remove: true,
            includeEmail: true
          });

          //Remove the listener to the sync event for the Order
          this.stopListening(this.order, "sync", this.confirmOrder);

        }
        catch(e){
          console.error("Failed to save while creating an Order: ", e);
        }
      },

      /**
      * When the new Order has been paid, redirect the user to a view that shows the new Order
      */
      showPaySuccess: function(){

        this.$el.html("Order has been paid!")

      }

    });

    return CreateOrderView;
});
