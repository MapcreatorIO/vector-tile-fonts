var fs = require('fs'),
    path = require('path');

var fontnik = require('fontnik'),
    glyphCompose = require('@mapbox/glyph-pbf-composite');

var ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Convert fonts'
});

parser.addArgument(
	['-i', '--input'],
	{
		help: 'Directory with fonts',
		required: true
	}
);

parser.addArgument(
	['-o', '--output'],
	{
		help: 'Output directory',
		required: true
	}
);

var args = parser.parseArgs();

if(!fs.existsSync(args.output)) {
	fs.mkdirSync(args.output);
}

var doFonts = function(dir, fonts) {
	var makeGlyphs = function(config) {
		var sourceFonts = {};
		var folderName = path.join(args.output, config.name);
		
		config.sources.forEach(function(sourceName) {
			if (!sourceFonts[sourceName]) {
				try {
					sourceFonts[sourceName] = fs.readFileSync(dir + '/' + sourceName);
				} catch(e) {}
			};
		});	

		if (!fs.existsSync(folderName)) {
			fs.mkdirSync(folderName);
		}

		var sizeSum = 0;
		var doRange = function(start, end) {
	    	return Promise.all(config.sources.map(function(sourceName) {
    	    var source = sourceFonts[sourceName];
	        if (!source) {
    			console.log('[%s] Source "%s" not found', config.name, sourceName);
		        return Promise.resolve();
        	}

        	return new Promise(function(resolve, reject) {
          		fontnik.range({
            		font: source,
            		start: start,
            		end: end
          		}, function(err, data) {
            		if (err) {
              			reject();
            		} else {
              			resolve(data);
            		}
          		});
        	});
      	})).then(function(results) {
        		results = results.filter(function(r) {return !!r;});
		        var combined = glyphCompose.combine(results);
    		    var size = combined.length;
        		sizeSum += size;
	        	fs.writeFileSync(folderName + '/' + start + '-' + end + '.pbf', combined);
	    	});
    	};

		var ranges = [];
		for (var i = 0; i < 65536; (i=i+256)) {
			ranges.push([i, Math.min(i+255, 65536)]);
		}
		
		console.log('[%s]', config.name);
		var fontPromise = Promise.all(ranges.map(function(range) {
								return doRange(range[0], range[1]);
		        			}));

		return fontPromise.then(function() {
			console.log('Total size %s B', sizeSum);
		});
	};

	return fonts.reduce(function(p, font) {
			return p.then(function() {
				return makeGlyphs(font);
			});
		}, Promise.resolve()
	);
};

var todo = [];
fs.readdirSync(args.input).forEach(function(dir) {
	var full_path = path.join(args.input, dir);
	var fonts;

	if (fs.lstatSync(full_path).isDirectory()) {
		if (fs.existsSync(path.resolve(full_path, 'fonts.json'))) {
			fonts = require(path.resolve(full_path, 'fonts.json'));
			fonts.forEach(function(font) {
				font.sources = font.sources.filter(function(f) {
					return f.indexOf('//') === -1;
				});
			});
		} else {
			fonts = [];
			fs.readdirSync(full_path).forEach(function(file) {
				if (path.extname(file) == '.ttf' || path.extname(file) == '.otf') {
					// var rex = /([A-Z])([A-Z])([a-z])|([a-z])([A-Z])/g;
					fonts.push({
						name: path.basename(file).slice(0, -4),
						sources: [
							path.basename(file)
						]
					});
				}
			});
		}
	}

	if (fonts && fonts.length) {
		todo.push([full_path, fonts]);
	}
});

todo.reduce(function(p, pair) {
	return p.then(function () {
		console.log('Directory [%s]:', pair[0]);
		return doFonts(pair[0], pair[1]);
	});
}, Promise.resolve());