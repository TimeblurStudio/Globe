var camera, scene, renderer;
var rotating;

//	contains a list of country codes with their matching country names
var isoFile = 'data/country_iso3166.json';
var latlonFile = 'data/country_lat_lon.json';
var dataFile = 'data/migration.json';

var mapIndexedImage, mapOutlineImage;
var lookupCanvas, lookupTexture;

//	contains above but organized as a mapped list via ['countryname'] = countryobject
//	each country object has data like center of country in 3d space, lat lon, country name, and country code
var countryData = new Object();

var selectableYears = [];
var selectableCountries = [];

var emigrantEnable = true;
var immigrantEnable = true;

var exportColor = 0x154492;//0xdd380c  //0x00abf4
var importColor = 0xdd380c;//0x154492 //0x00fd30
 
//	the currently selected country
var selectedCountry = null;
var previouslySelectedCountry = null;

//	contains info about what year, what countries, categories, etc that's being visualized
var selectionData;

function start( e ){	
	if ( ! Detector.webgl ) {
		Detector.addGetWebGLMessage();
	}
	else{
		loadCountryCodes(
			function(){
				loadWorldPins(
					function(){										
						loadContentData(								
							function(){																	
								init();
								animate();		
							}
							);														
					}
					);
			}
		);		
	}
}

function emigrantButtonClicked(){
	if(emigrantEnable){
		emigrantEnable = false;
		$(".emigrantButton").css("border-bottom", "4px solid #7f8c8d");
		$("#topExportdiv").hide();
	}else{
		emigrantEnable = true;
		$(".emigrantButton").css("border-bottom", "4px solid #154492");
		$("#topExportdiv").show();
	}

	setSelectData(timeBins, '2010', [selectedCountry.countryName]);
}

function immigrantButtonClicked(){
	if(immigrantEnable){
		immigrantEnable = false;
		$(".immigrantButton").css("border-bottom", "4px solid #7f8c8d");
		$("#topImportdiv").hide();
	}else{
		immigrantEnable = true;
		$(".immigrantButton").css("border-bottom", "4px solid #dd380c");
		$("#topImportdiv").show();
	}
	setSelectData(timeBins, '2010', [selectedCountry.countryName]);
}

function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 );
	camera.position.z = 1400;
	camera.lookAt(scene.width/2, scene.height/2);	
	
	var light = new THREE.AmbientLight( 0xc0c0c0 );
	scene.add(light);
	
	lookupCanvas = document.createElement('canvas');	
	lookupCanvas.width = 256;
	lookupCanvas.height = 1;

	lookupTexture = new THREE.Texture( lookupCanvas );
	lookupTexture.name = "lookup";
	lookupTexture.magFilter = THREE.NearestFilter;
	lookupTexture.minFilter = THREE.NearestFilter;
	//lookupTexture.needsUpdate = true;

	var indexedMapTexture =  THREE.ImageUtils.loadTexture( 'images/map_indexed.png' );//new THREE.Texture( mapIndexedImage );
	//indexedMapTexture.needsUpdate = true;
	indexedMapTexture.magFilter = THREE.NearestFilter;
	indexedMapTexture.minFilter = THREE.NearestFilter;

	var outlinedMapTexture = THREE.ImageUtils.loadTexture( 'images/map_outline.png' );//new THREE.Texture( mapOutlineImage );
	//outlinedMapTexture.needsUpdate = true;

	var uniforms = {
		'mapIndex': { type: 't', value: indexedMapTexture  },		
		'lookup': { type: 't', value: lookupTexture },
		'outline': { type: 't', value: outlinedMapTexture },
		'outlineLevel': {type: 'f', value: 1 },
	};
	mapUniforms = uniforms;

	var shaderMaterial = new THREE.ShaderMaterial( {
		uniforms: 		uniforms,
		vertexShader:   document.getElementById( 'globeVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'globeFragmentShader' ).textContent,
	});

	rotating = new THREE.Object3D();
	scene.add(rotating);

	var sphere = new THREE.Mesh( new THREE.SphereGeometry( 100, 40, 40 ),  shaderMaterial);
	sphere.rotation.x = Math.PI;				
	sphere.rotation.y = -Math.PI/2;
	sphere.rotation.z = Math.PI;
	rotating.add(sphere);

	for( var i in timeBins ){					
		var bin = timeBins[i].data;
		for( var s in bin ){
			var set = bin[s];
			var exporterName = set.s.toUpperCase();
			var importerName = set.d.toUpperCase();
			//	let's track a list of actual countries listed in this data set
			//	this is actually really slow... consider re-doing this with a map
			if( $.inArray(exporterName, selectableCountries) < 0 )
				selectableCountries.push( exporterName );
			if( $.inArray(importerName, selectableCountries) < 0 )
				selectableCountries.push( importerName );
		}
	}

	// load geo data (country lat lons in this case)
	console.time('loadGeoData');
	loadGeoData( latlonData );				
	console.timeEnd('loadGeoData');

	console.time('buildDataVizGeometries');
	var vizilines = buildDataVizGeometries(timeBins);
	console.timeEnd('buildDataVizGeometries');

	visualizationMesh = new THREE.Object3D();
	rotating.add(visualizationMesh);	

	selectionData = new Object();
	setSelectData(timeBins, '2010', ['INDIA']);
	updateUI();
	//console.log(selectedCountry);
	
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	//

	stats = new Stats();
	document.body.appendChild( stats.domElement ); 

	//	-----------------------------------------------------------------------------
    //	Event listeners
	document.addEventListener( 'mousemove', onDocumentMouseMove, true );
	document.addEventListener( 'mousedown', onDocumentMouseDown, true );	
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );	
	
	window.addEventListener( 'resize', onWindowResize, false );
	
	document.addEventListener( 'click', onClick, true );	
	document.addEventListener( 'mousewheel', onMouseWheel, false );
	//	firefox	
	document.addEventListener( 'DOMMouseScroll', function(e){
		    var evt=window.event || e; //equalize event object
    		onMouseWheel(evt);
	}, false );
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updateUI(){
	//console.log(selectedCountry);

	document.getElementById("selectedCountryName").innerHTML = selectedCountry.countryName;
	var htmlContent = "Emigrant:&nbsp&nbsp&nbsp" +  numberWithCommas(selectedCountry.exportedAmount) 
						+ "<br>" 
						+ "Immigrant: " +  numberWithCommas(selectedCountry.importedAmount); 
	document.getElementById("selectedCountryStats").innerHTML = htmlContent;
	$('#selectedCountrySummary').show();

	var tableExport = document.getElementById("topExport");
	tableExport.innerHTML="";//clear
	for(var r=0; r < selectedCountry.top.required; r++){
		var row = tableExport.insertRow(r);
		var cell1 = row.insertCell(0);
		var cell2 = row.insertCell(1);
		cell1.innerHTML = selectedCountry.top.exported.rank[r].country;
		cell2.innerHTML = numberWithCommas(selectedCountry.top.exported.rank[r].value);
	}
	var tableImport = document.getElementById("topImport");
	tableImport.innerHTML="";//clear
	for(var r=0; r < selectedCountry.top.required; r++){
		var row = tableImport.insertRow(r);
		var cell1 = row.insertCell(0);
		var cell2 = row.insertCell(1);
		cell1.innerHTML = selectedCountry.top.imported.rank[r].country;
		cell2.innerHTML = numberWithCommas(selectedCountry.top.imported.rank[r].value);
	}

	$('#topInfo').show();
}

function setSelectData(linearData, year, countries){
	selectionData.selectedYear = year;
	selectionData.selectedCountry = countries[0].toUpperCase();
	
	selectVisualization( timeBins, '2010', [countries[0].toUpperCase()]);
}

function findCode(countryName){
	countryName = countryName.toUpperCase();
	for( var i in countryLookup ){
		if( countryLookup[i] === countryName )
			return i;
	}
	return 'not found';
}

//	ordered lookup list for country color index
//	used for GLSL to find which country needs to be highlighted
var countryColorMap = {'PE':1,
'BF':2,'FR':3,'LY':4,'BY':5,'PK':6,'ID':7,'YE':8,'MG':9,'BO':10,'CI':11,'DZ':12,'CH':13,'CM':14,'MK':15,'BW':16,'UA':17,
'KE':18,'TW':19,'JO':20,'MX':21,'AE':22,'BZ':23,'BR':24,'SL':25,'ML':26,'CD':27,'IT':28,'SO':29,'AF':30,'BD':31,'DO':32,'GW':33,
'GH':34,'AT':35,'SE':36,'TR':37,'UG':38,'MZ':39,'JP':40,'NZ':41,'CU':42,'VE':43,'PT':44,'CO':45,'MR':46,'AO':47,'DE':48,'SD':49,
'TH':50,'AU':51,'PG':52,'IQ':53,'HR':54,'GL':55,'NE':56,'DK':57,'LV':58,'RO':59,'ZM':60,'IR':61,'MM':62,'ET':63,'GT':64,'SR':65,
'EH':66,'CZ':67,'TD':68,'AL':69,'FI':70,'SY':71,'KG':72,'SB':73,'OM':74,'PA':75,'AR':76,'GB':77,'CR':78,'PY':79,'GN':80,'IE':81,
'NG':82,'TN':83,'PL':84,'NA':85,'ZA':86,'EG':87,'TZ':88,'GE':89,'SA':90,'VN':91,'RU':92,'HT':93,'BA':94,'IN':95,'CN':96,'CA':97,
'SV':98,'GY':99,'BE':100,'GQ':101,'LS':102,'BG':103,'BI':104,'DJ':105,'AZ':106,'MY':107,'PH':108,'UY':109,'CG':110,'RS':111,'ME':112,'EE':113,
'RW':114,'AM':115,'SN':116,'TG':117,'ES':118,'GA':119,'HU':120,'MW':121,'TJ':122,'KH':123,'KR':124,'HN':125,'IS':126,'NI':127,'CL':128,'MA':129,
'LR':130,'NL':131,'CF':132,'SK':133,'LT':134,'ZW':135,'LK':136,'IL':137,'LA':138,'KP':139,'GR':140,'TM':141,'EC':142,'BJ':143,'SI':144,'NO':145,
'MD':146,'LB':147,'NP':148,'ER':149,'US':150,'KZ':151,'AQ':152,'SZ':153,'UZ':154,'MN':155,'BT':156,'NC':157,'FJ':158,'KW':159,'TL':160,'BS':161,
'VU':162,'FK':163,'GM':164,'QA':165,'JM':166,'CY':167,'PR':168,'PS':169,'BN':170,'TT':171,'CV':172,'PF':173,'WS':174,'LU':175,'KM':176,'MU':177,
'FO':178,'ST':179,'AN':180,'DM':181,'TO':182,'KI':183,'FM':184,'BH':185,'AD':186,'MP':187,'PW':188,'SC':189,'AG':190,'BB':191,'TC':192,'VC':193,
'LC':194,'YT':195,'VI':196,'GD':197,'MT':198,'MV':199,'KY':200,'KN':201,'MS':202,'BL':203,'NU':204,'PM':205,'CK':206,'WF':207,'AS':208,'MH':209,
'AW':210,'LI':211,'VG':212,'SH':213,'JE':214,'AI':215,'MF_1_':216,'GG':217,'SM':218,'BM':219,'TV':220,'NR':221,'GI':222,'PN':223,'MC':224,'VA':225,
'IM':226,'GU':227,'SG':228};


function highlightCountry( countries ){
	var countryCodes = [];
	for( var i in countries ){
		var code = findCode(countries[i]);
		countryCodes.push(code);
	}

	var ctx = lookupCanvas.getContext('2d');	
	ctx.clearRect(0,0,256,1);

	//	color index 0 is the ocean, leave it something neutral
	
	//	this fixes a bug where the fill for ocean was being applied during pick
	//	all non-countries were being pointed to 10 - bolivia
	//	the fact that it didn't select was because bolivia shows up as an invalid country due to country name mismatch
	//	...
	var pickMask = countries.length == 0 ? 0 : 1;
	var oceanFill = 10 * pickMask;
	ctx.fillStyle = 'rgb(' + oceanFill + ',' + oceanFill + ',' + oceanFill +')';
	ctx.fillRect( 0, 0, 1, 1 );


	var selectedCountryCode = selectedCountry.countryCode;
	
	for( var i in countryCodes ){
		var countryCode = countryCodes[i];
		var colorIndex = countryColorMap[ countryCode ];

		var mapColor = countryData[countries[i]].mapColor;
		var fillCSS = '#333333';
		if( countryCode === selectedCountryCode )
			fillCSS = '#eeeeee'
		ctx.fillStyle = fillCSS;
		ctx.fillRect( colorIndex, 0, 1, 1 );
	}
	
	lookupTexture.needsUpdate = true;
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	globeRotate();

	requestAnimationFrame( animate );

	scene.traverse(function (mesh) {
			if (mesh.update !== undefined) {
				mesh.update();
			}
		});
	stats.update();
	
	renderer.render( scene, camera );

}

function globeRotate(){
	if( rotateTargetX !== undefined && rotateTargetY !== undefined ){

		rotateVX += (rotateTargetX - rotateX) * 0.012;
		rotateVY += (rotateTargetY - rotateY) * 0.012;

		if( Math.abs(rotateTargetX - rotateX) < 0.1 && Math.abs(rotateTargetY - rotateY) < 0.1 ){
			rotateTargetX = undefined;
			rotateTargetY = undefined;
		}
	}

	rotateX += rotateVX;
	rotateY += rotateVY;	
	rotateVX *= 0.98;
	rotateVY *= 0.98;
	if(dragging || rotateTargetX !== undefined ){
		rotateVX *= 0.6;
		rotateVY *= 0.6;
	}	     
	rotateY += 0 * 0.01;
	//	constrain the pivot up/down to the poles
	//	force a bit of bounce back action when hitting the poles
	if(rotateX < -rotateXMax){
		rotateX = -rotateXMax;
		rotateVX *= -0.95;
	}
	if(rotateX > rotateXMax){
		rotateX = rotateXMax;
		rotateVX *= -0.95;
	}		    			    		   

	rotating.rotation.x = rotateX;
	rotating.rotation.y = rotateY;
}


function getPickColor(){
	var affectedCountries = undefined;
	if( visualizationMesh.children[0] !== undefined )
		affectedCountries = visualizationMesh.children[0].affectedCountries;

	highlightCountry([]);
	rotating.remove(visualizationMesh);
	mapUniforms['outlineLevel'].value = 0;
	lookupTexture.needsUpdate = true;

	renderer.autoClear = false;
	renderer.autoClearColor = false;
	renderer.autoClearDepth = false;
	renderer.autoClearStencil = false;	
	renderer.preserve

    renderer.clear();
    renderer.render(scene,camera);

    var gl = renderer.context;
    gl.preserveDrawingBuffer = true;

	var mx = ( mouseX + renderer.context.canvas.width/2 );//(mouseX + renderer.context.canvas.width/2) * 0.25;
	var my = ( -mouseY + renderer.context.canvas.height/2 );//(-mouseY + renderer.context.canvas.height/2) * 0.25;
	mx = Math.floor( mx );
	my = Math.floor( my );

	var buf = new Uint8Array( 4 );		    	
	// console.log(buf);
	gl.readPixels( mx, my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf );
	// console.log(buf);		

	renderer.autoClear = true;
	renderer.autoClearColor = true;
	renderer.autoClearDepth = true;
	renderer.autoClearStencil = true;

	gl.preserveDrawingBuffer = false;	

	mapUniforms['outlineLevel'].value = 1;
	rotating.add(visualizationMesh);


	if( affectedCountries !== undefined ){
		highlightCountry(affectedCountries);
	}
	return buf[0]; 	
}