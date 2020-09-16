function buildDataVizGeometries( linearData ){	

	//var loadLayer = document.getElementById('loading');

	for( var i in linearData ){
		var yearBin = linearData[i].data;		

		var year = linearData[i].t;
		selectableYears.push(year);	

		var count = 0;
		console.log('Building data for ...' + year);
		for( var s in yearBin ){
			var set = yearBin[s];

			var exporterName = set.s.toUpperCase();
			var importerName = set.d.toUpperCase();

			exporter = countryData[exporterName];
			importer = countryData[importerName];	
			
			//	we couldn't find the country, it wasn't in our list...
			if( exporter === undefined || importer === undefined )
				continue;			

			//	visualize this event
			set.lineGeometry = makeConnectionLineGeometry( exporter, importer, set.v );
		}

	}			

	//loadLayer.style.display = 'none';	
}

function getVisualizedMesh( linearData, year, countries ){
	//	for comparison purposes, all caps the country names

	for( var i in countries ){
		countries[i] = countries[i].toUpperCase();
	}

	//	pick out the year first from the data
	var indexFromYear = parseInt(year) - 2010;
	var offset = 2;
	if( indexFromYear >= timeBins.length )
		indexFromYear = timeBins.length-offset;

	var affectedCountries = [];

	var bin = linearData[indexFromYear].data;	

	var linesGeo = new THREE.Geometry();
	var lineColors = [];

	var particlesGeo = new THREE.Geometry();
	var particleColors = [];			

	//	go through the data from year, and find all relevant geometries
	for( i in bin ){
		var set = bin[i];

		//	filter out countries we don't care about
		var exporterName = set.s.toUpperCase();
		var importerName = set.d.toUpperCase();
		var relevantExport = $.inArray(exporterName, countries) >= 0;
		var relevantImport = $.inArray(importerName, countries) >= 0;
		var useExporter = relevantExport;
		var useImporter = relevantImport;

		if( (useImporter || useExporter) ){
			//	we may not have line geometry... (?)
			if( set.lineGeometry === undefined )
				continue;

			var thisLineIsExport = false;
			var skip = true;

			if(exporterName == selectedCountry.countryName ){
				thisLineIsExport = true;
				if(emigrantEnable)
					skip = false;
			}

			if(!thisLineIsExport){
				if(immigrantEnable)
					skip = false;
			}

			if(!skip){
			var lineColor = thisLineIsExport ? new THREE.Color(exportColor) : new THREE.Color(importColor);

			var lastColor;
			//	grab the colors from the vertices
			for( s in set.lineGeometry.vertices ){
				var v = set.lineGeometry.vertices[s];		
				lineColors.push(lineColor);
				lastColor = lineColor;
			}

			//	merge it all together
			var lineMesh = new THREE.Mesh(set.lineGeometry);
			lineMesh.updateMatrix();
			linesGeo.merge( lineMesh.geometry, lineMesh.matrix );
			
			var particleColor = lastColor.clone();		
			var points = set.lineGeometry.vertices;
			var particleCount = Math.floor(set.v / (8000) / set.lineGeometry.vertices.length) + 1;
			particleCount = constrain(particleCount,1,100);
			var particleSize = set.lineGeometry.size;			
			for( var s=0; s<particleCount; s++ ){
				// var rIndex = Math.floor( Math.random() * points.length );
				// var rIndex = Math.min(s,points.length-1);

				var desiredIndex = s / particleCount * points.length;
				var rIndex = constrain(Math.floor(desiredIndex),0,points.length-1);

				var point = points[rIndex];						
				var particle = point.clone();
				particle.moveIndex = rIndex;
				particle.nextIndex = rIndex+1;
				if(particle.nextIndex >= points.length )
					particle.nextIndex = 0;
				particle.lerpN = 0;
				particle.path = points;
				particlesGeo.vertices.push( particle );	
				particle.size = particleSize;
				particleColors.push( particleColor );						
			}

			if( $.inArray( exporterName, affectedCountries ) < 0 ){
				affectedCountries.push(exporterName);
			}							

			if( $.inArray( importerName, affectedCountries ) < 0 ){
				affectedCountries.push(importerName);
			}

		}

			var vb = set.v;
			var exporterCountry = countryData[exporterName];
			if( exporterCountry.mapColor === undefined ){
				exporterCountry.mapColor = vb;
			}
			else{				
				exporterCountry.mapColor += vb;
			}			

			var importerCountry = countryData[importerName];
			if( importerCountry.mapColor === undefined ){
				importerCountry.mapColor = vb;
			}
			else{				
				importerCountry.mapColor += vb;
			}

			exporterCountry.exportedAmount += vb;
			importerCountry.importedAmount += vb;

			for(var r=0; r < selectedCountry.top.required; r++){
				if(selectedCountry.top.exported.rank[r] == undefined){
					selectedCountry.top.exported.rank[r] = {};
					selectedCountry.top.exported.rank[r].value = 0;
					selectedCountry.top.exported.rank[r].country = "";
				}
				if(selectedCountry.top.imported.rank[r] == undefined){
					selectedCountry.top.imported.rank[r] = {};
					selectedCountry.top.imported.rank[r].value = 0;
					selectedCountry.top.imported.rank[r].country = "";
				}
			}

			if( exporterCountry == selectedCountry ){
				var updatedValue = false;
				for(var r=0; r < selectedCountry.top.required; r++){
					if(selectedCountry.top.exported.rank[r].value < set.v && updatedValue != true){
						selectedCountry.top.exported.rank[r].value = set.v;
						selectedCountry.top.exported.rank[r].country = set.d;
						updatedValue = true;
					}
				}
				selectedCountry.summary.exported.total += set.v;				
			}		
			if( importerCountry == selectedCountry ){
				var updatedValue = false;
				for(var r=0; r < selectedCountry.top.required; r++){
					if(selectedCountry.top.imported.rank[r].value < set.v && updatedValue != true){
						selectedCountry.top.imported.rank[r].value = set.v;
						selectedCountry.top.imported.rank[r].country = set.s;
						updatedValue = true;
					}					
				}

				selectedCountry.summary.imported.total += set.v;
			}

			if( importerCountry == selectedCountry || exporterCountry == selectedCountry ){
				selectedCountry.summary.total += set.v;	
			}

			
		}		
	}

	linesGeo.colors = lineColors;	

	//	make a final mesh out of this composite
	var splineOutline = new THREE.Line( linesGeo, new THREE.LineBasicMaterial( 
		{ 	color: 0xffffff, opacity: 0.8, blending: 
			THREE.NormalBlending, transparent:true, 
			depthWrite: false, vertexColors: true, 
			linewidth: 1 } ) 
	);

	splineOutline.renderDepth = false;	

	var particleGraphic = THREE.ImageUtils.loadTexture("images/sprite.png");
	var particleMat = new THREE.ParticleBasicMaterial( { map: particleGraphic, color: 0xffffff, size: 40, 
														blending: THREE.AdditiveBlending, transparent:true, 
														depthWrite: false, vertexColors: true,
														sizeAttenuation: true } );
	particlesGeo.colors = particleColors;
	var pSystem = new THREE.ParticleSystem( particlesGeo,  particleMat);//, shaderMaterial
	pSystem.dynamic = true;
	splineOutline.add( pSystem );

	pSystem.update = function(){	
		// var time = Date.now()									
		for( var i in this.geometry.vertices ){						
			var particle = this.geometry.vertices[i];
			var path = particle.path;
			var moveLength = path.length;
			
			particle.lerpN += 0.05;
			if(particle.lerpN > 1){
				particle.lerpN = 0;
				particle.moveIndex = particle.nextIndex;
				particle.nextIndex++;
				if( particle.nextIndex >= path.length ){
					particle.moveIndex = 0;
					particle.nextIndex = 1;
				}
			}

			var currentPoint = path[particle.moveIndex];
			var nextPoint = path[particle.nextIndex];
			

			particle.copy( currentPoint );
			particle.lerp( nextPoint, particle.lerpN );			
		}
		this.geometry.verticesNeedUpdate = true;
	};

	//	return this info as part of the mesh package, we'll use this in selectvisualization
	splineOutline.affectedCountries = affectedCountries;


	return splineOutline;	
}

function selectVisualization( linearData, year, countries){
	//	we're only doing one country for now so...
	var cName = countries[0].toUpperCase();
	
	previouslySelectedCountry = selectedCountry;
	selectedCountry = countryData[countries[0].toUpperCase()];

	selectedCountry.summary = {
		imported: {
			total: 0,
		},
		exported: {
			total: 0,
		},
		total: 0
	};

	selectedCountry.top = {
		imported: {
			rank: [],
		},
		exported: {	
			rank: [],
		},
		required: 5, 
	};

	
	//	clear off the country's internally held color data we used from last highlight
	for( var i in countryData ){
		var country = countryData[i];
		country.exportedAmount = 0;
		country.importedAmount = 0;
		country.mapColor = 0;
	}

	//	clear children
	while( visualizationMesh.children.length > 0 ){
		var c = visualizationMesh.children[0];
		visualizationMesh.remove(c);
	}

	//	build the mesh
	console.time('getVisualizedMesh');
	var mesh = getVisualizedMesh( timeBins, year, countries );				
	console.timeEnd('getVisualizedMesh');

	//	add it to scene graph
	visualizationMesh.add( mesh );	

	//	alright we got no data but at least highlight the country we've selected
	if( mesh.affectedCountries.length == 0 ){
		mesh.affectedCountries.push( cName );
	}	

	/*
	for( var i in mesh.affectedCountries ){
		var countryName = mesh.affectedCountries[i];
		var country = countryData[countryName];
		attachMarkerToCountry( countryName, country.mapColor );
	}
	*/

	highlightCountry( mesh.affectedCountries );

	if( previouslySelectedCountry !== selectedCountry ){
		if( selectedCountry ){
			rotateTargetX = selectedCountry.lat * Math.PI/180;
			var targetY0 = -(selectedCountry.lon - 9) * Math.PI / 180;
            var piCounter = 0;
			while(true) {
                var targetY0Neg = targetY0 - Math.PI * 2 * piCounter;
                var targetY0Pos = targetY0 + Math.PI * 2 * piCounter;
                if(Math.abs(targetY0Neg - rotating.rotation.y) < Math.PI) {
                    rotateTargetY = targetY0Neg;
                    break;
                } else if(Math.abs(targetY0Pos - rotating.rotation.y) < Math.PI) {
                    rotateTargetY = targetY0Pos;
                    break;
                }
                piCounter++;
                rotateTargetY = wrap(targetY0, -Math.PI, Math.PI);
			}
            
            //lines commented below source of rotation error
			//is there a more reliable way to ensure we don't rotate around the globe too much? 
			/*
			if( Math.abs(rotateTargetY - rotating.rotation.y) > Math.PI )
				rotateTargetY += Math.PI;		
			*/
			rotateVX *= 0.6;
			rotateVY *= 0.6;	
	
		}	
	}
}
