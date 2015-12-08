/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/TextView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/StatsView', 'views/UserView', 'views/ExternalView', 'views/LdapView'], 				
function ($, _, Backbone, IndexView, TextView, DataCatalogView, RegistryView, MetadataView, StatsView, UserView, ExternalView, LdapView, DataDetailsView) {
	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',         // the default route
			'about(/:anchorId)'         : 'renderAbout',        // about page anchors
			'help(/:page)(/:anchorId)'  : 'renderHelp',
			'data(/mode=:mode)(/query=:query)(/page/:page)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata',     // metadata page
			'profile(/*username)(/s=:section)(/s=:subsection)' : 'renderProfile',
			'myAccount'                   : 'renderUserSettings',
			'profile' : 'renderProfile',
			'external(/*url)'           : 'renderExternal',     // renders the content of the given url in our UI
			'logout'                    : 'logout'          // logout the user
			//'api(/:anchorId)'           : 'renderAPI'       // API page 
		},
		
		helpPages: {
			"search" : "searchTips",
			defaultPage : "searchTips"
		},
		
		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);
			
			appView.indexView = new IndexView();
			appView.textView = new TextView();
			appView.dataCatalogView = new DataCatalogView();
			//appView.registryView = new RegistryView();
			appView.metadataView = new MetadataView();
			appView.statsView = new StatsView();
			appView.userView = new UserView();
			appView.externalView = new ExternalView();
			//appView.ldapView = new LdapView();
		},
		
		routeHistory: new Array(),
		
		// Will return the last route, which is actually the second to last item in the route history, 
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((typeof this.routeHistory === "undefined") || (this.routeHistory.length <= 1))
				return false;
			else
				return this.routeHistory[this.routeHistory.length-2];
		},

		renderIndex: function (param) {
			this.routeHistory.push("index");
			appView.showView(appView.indexView);
		},
		
		renderHelp: function(page, anchorId){
			this.routeHistory.push("help");
			appModel.set('anchorId', anchorId);
			
			if(page)
				var pageName = this.helpPages[page];
			else
				var pageName = this.helpPages["defaultPage"]; //default
			
			var options = {
				pageName: pageName,
				anchorId: anchorId
			}
			
			appView.showView(appView.textView, options);
		},
		
		renderAbout: function (anchorId) {
			this.routeHistory.push("about");
			appModel.set('anchorId', anchorId);
			var options = {
					pageName: "about",
					anchorId: anchorId
				}
			
			appView.showView(appView.textView, options);
		},
		
		renderAPI: function (anchorId) {
			this.routeHistory.push("api");
			appModel.set('anchorId', anchorId);
			var options = {
					pageName: "api",
					anchorId: anchorId
				}
			
			appView.showView(appView.textView, options);
		},
		
		renderTools: function (anchorId) {
			this.routeHistory.push("tools");
			appModel.set('anchorId', anchorId);
			
			var options = {
					pageName: "tools",
					anchorId: anchorId
				}
			
			appView.showView(appView.textView, options);
		},
		
		renderData: function (mode, query, page) {
			this.routeHistory.push("data");
			
			//Check for the URL parameters
			if(typeof page === "undefined")
				appModel.set("page", 0);
			else
				appModel.set('page', page);
			
			//If a search mode parameter is given
			if((typeof mode !== "undefined") && mode)
				//appModel.set('searchMode', mode)
				appView.dataCatalogView.mode = mode;

			//If a query parameter is given
			if((typeof query !== "undefined") && query){
				var customQuery = appSearchModel.get('additionalCriteria');
				customQuery.push(query);
				appSearchModel.set('additionalCriteria', customQuery);
			}
			
			appView.showView(appView.dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			appModel.set('lastPid', appModel.get("pid"));
			
			//Check for a seriesId
			if(appModel.get("useSeriesId") && (pid.indexOf("version:") > -1)){
				appView.metadataView.seriesId = pid.substr(0, pid.indexOf(", version:"));
				
				pid = pid.substr(pid.indexOf(", version: ") + ", version: ".length);				
			}
			else
				appView.metadataView.seriesId = "";
			
			appModel.set('pid', pid);			
			appView.metadataView.pid = pid;
			
			appView.showView(appView.metadataView);
		},
		
		renderProfile: function(username, section, subsection){
			this.closeLastView();
						
			if(!username || !appModel.get("userProfiles")){
				this.routeHistory.push("summary");
				appView.showView(appView.statsView);
			}
			else{
				if(section)
					appView.userView.activeSection = section;
				if(subsection)
					appView.userView.activeSubSection = subsection;
				
				this.routeHistory.push("profile");
				appModel.set("profileUsername", username);
				appView.showView(appView.userView);
			}
		},
		
		renderUserSettings: function(){			
			this.closeLastView();

			appView.userView.activeSection = "settings";
			this.routeHistory.push("profile");
			
			if(appUserModel.get("username"))
				appModel.set("profileUsername", appUserModel.get("username"));	
			
			appView.showView(appView.userView);
		},
		
		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");
			appView.registryView.stage = stage;
			appView.registryView.pid = pid;
			appView.showView(appView.registryView);
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			appView.ldapView.stage = stage;
			appView.showView(appView.ldapView);
		},
		
		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;
			
			//Construct the sign out url and redirect
			var signOutUrl = appModel.get('signOutUrl');
			var target = Backbone.history.location.href;
			
			// DO NOT include the route otherwise we have an infinite redirect
			target  = target.split("#")[0];
			
			// make sure to include the target
			signOutUrl += "?target=" + target;
			
			// do it!
			window.location = signOutUrl;
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");
			appView.externalView.url = url;
			appView.showView(appView.externalView);
		},
		
		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(appModel.defaultView, {trigger: true});
		},
		
		closeLastView: function(){
			//Get the last route and close the view
			var lastRoute = _.last(this.routeHistory);
			
			if(lastRoute == "summary")
				appView.statsView.onClose();				
			else if(lastRoute == "profile")
				appView.userView.onClose();
		}
		
	});

	return UIRouter;
});