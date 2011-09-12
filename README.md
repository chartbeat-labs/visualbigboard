Introduction
------------

`visual bigboard` is an extension to [bigboard] (https://github.com/chartbeat/labs/tree/master/bigboard). This tool visualizes the top pages for the given host by putting them in a rectangular grid, and shows each page as an image. Obtaining the images for the given publisher is done via using [embedly] (http://embed.ly/) API. So, if the particular host does not have embedly integration, you would have to extend the portion that gets the images for a page.

Usage & Dependencies
---------------------
The main application consists of these three files:
* index.html
* main.js
* main.css
* colorbox.css

and, has dependencies on:

* [jquery-1.6.2.min.js] (http://jquery.com) 
* [isotope.js] (http://isotope.metafizzy.co/) - Used for grid-based layout
* [jquery.colorbox-min.js] (http://colorpowered.com/colorbox/) - Used for creating a modal window

The dependencies included in the /lib directory.

The application can be run by pointing a static file server to the root of the
repository.

Configuration
---------------
All the configuration is managed either via constants set in demo.ConfigManager
class or via url parameters. The required paramaters are:

* HOST - the publisher for which the visualization will be done.
* API_KEY - The api key from Chartbeat.com for the particular publisher.
* EMBEDLY_KEY - An api key for accessing embedly api.

Issues
------
Please report issues via [github issues] or via @daniyalzade
