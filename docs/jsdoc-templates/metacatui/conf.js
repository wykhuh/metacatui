'use strict';

module.exports = {
  "source": {
    "excludePattern": "js/themes/|components/|config/|css/|font/|img/"
  },
  "templates": {
    "default": {
      "outputSourceFiles" : true,
      "layoutFile" : "./docs/jsdoc-templates/metacatui/tmpl/layout.tmpl",
      "staticFiles": {
        "include": [
            "./docs/jsdoc-templates/metacatui/static/styles/style.css"
        ]
      }
    }
  }
}
