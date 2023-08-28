// Notes
// 1 unit in Three js is equal to 1 meter in SketchUp when using Khronos GLTF exporter
//

// Three JS libraries
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// Local libraries
//import * as projectSettings from './project_settings.js';
//import * as materials from './materials.js';
//import * as lights from './lights.js';
//import * as constructors from './constructors.js';


const sceneProperties = {};

const currentURL = window.location.href;
const urlObj = new URL(currentURL);
const params = new URLSearchParams(urlObj.search);
if ([...params.keys()].length > 0) {
    sceneProperties.stageAreaLightColor = new THREE.Color(parseInt(params.get('stageAreaLightColor'), 16));
    sceneProperties.mainAreaLightColor = new THREE.Color(parseInt(params.get('mainAreaLightColor'), 16));
} else {
    sceneProperties.stageAreaLightColor = new THREE.Color(parseInt("1fd122", 16));
    sceneProperties.mainAreaLightColor = new THREE.Color(parseInt("ffffff", 16));
}

function intToRgb(intColor) {
    const r = (intColor >> 16) & 255;
    const g = (intColor >> 8) & 255;
    const b = intColor & 255;

    return new THREE.Color(`rgb(${r}, ${g}, ${b})`);
}


//
// Globals
//
let container, stats, clock, axesHelper;
let scene, camera, renderer, controlsPointerLock, controlsOrbit;
let composer, renderPass, saoPass;
let platform = new THREE.Group();
let nativeObjects = [];
let gltfModels = [];

const color_audienceTablecloth = 0x46418C;
const color_AudienceChair = 0x46415D;
const color_AudienceChairFrame = 0x000000;

const gltfLoader = new GLTFLoader();


let maxWalkHeight = 8 * 0.3048; // feet x m/foot
let walkHight = 5.5 * 0.3048; // feet x m/foot
let minSitHeight = 2.5 * 0.3048; // feet x m/foot

// Navigation settings
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let materialEmissive_stage = new THREE.MeshStandardMaterial({
    color: sceneProperties.stageAreaLightColor,
    emissive: sceneProperties.stageAreaLightColor,
    name: "Stage"
});
let materialEmissive_main = new THREE.MeshStandardMaterial({
    color: sceneProperties.mainAreaLightColor,
    emissive: sceneProperties.mainAreaLightColor,
    name: "Main"
});

//
// Functions
//

function createWalkButton() {
    const button = document.createElement('button');
    button.innerHTML = 'Walk';
    button.id = 'lockButton';
    button.style.position = 'absolute';
    button.style.zIndex = '10';
    button.style.top = '10px';
    button.style.left = '10px';
    document.body.appendChild(button);
    return button;
}
function saveSettingsButton() {
    const button = document.createElement('button');
    button.innerHTML = 'Save Settings';
    button.id = 'runButton';
    button.style.position = 'absolute';
    button.style.zIndex = '10';
    button.style.top = '10px';
    button.style.left = '60px';  // Set this value to position the "Run" button to the right of the "Walk" button
    document.body.appendChild(button);
    return button;
}


function updateURLWithProperties(properties) {
    
    console.log(typeof sceneProperties.mainAreaLightColor);
    console.log(sceneProperties.mainAreaLightColor);
    sceneProperties.stageAreaLightColor = sceneProperties.stageAreaLightColor.getHexString();
    sceneProperties.mainAreaLightColor = sceneProperties.mainAreaLightColor.getHexString();

    const params = new URLSearchParams();
  
    for (const [key, value] of Object.entries(properties)) {
      params.set(key, value);
      console.log(value);
    }
    //params.set('mainAreaLightColor', hexString);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  }

function loadGLTFModel(path, castShadow, receiveShadow) {
    const loader = new GLTFLoader();
    loader.load(path, (gltf) => {
        let model = gltf.scene;
        // Traverse the model and enable shadows for each mesh
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = castShadow;
                // if (child.material.name.includes("Paint - White")) {
                //     child.material = materials.materialWhitePaint;
                // }
                // if (child.material.name.includes("Light - Emissive - Stage Area")) {
                //     child.material = materials.materialEmissive_stage;
                // }
                // if (child.material.name.includes("Light - Emissive - Main Area")) {
                //     child.material = materials.materialEmissive_main;
                // }
                //Light - Emissive
                //child.material = materials.defaultMaterial;
                child.receiveShadow = receiveShadow;  // Let the plane receive shadows
                //console.log(child.material.name);
            }
        });
        scene.add(model);
        gltfModels.push(model);
    });
}




// 
// Init
//
function init() {
    
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    clock = new THREE.Clock();

    scene = new THREE.Scene();

    scene.background = new THREE.Color( "rgb(227, 238, 250)" );

    // Show XYZ Axis
    axesHelper = new THREE.AxesHelper(500);
    scene.add(axesHelper);

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor( 0x000000 );
    renderer.setPixelRatio( 2 * devicePixelRatio );
    renderer.setSize( width, height );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 
    // Camera
    // 
    camera = new THREE.PerspectiveCamera( 65, width / height, .1, 1000 );
    camera.position.x = 25;
    camera.position.z = 25;
    camera.position.y = 25;
    camera.lookAt(0, 0, 0);

    // ////////////////////////
    // Lights
    // ////////////////////////
    //lights.addSceneLights(scene);

    // Global
    const intensityAdjustment = 1;
    const ambientIntensity = 0;
    let positionsArray = [];
    let lightHeight;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity * intensityAdjustment);
    scene.add(ambientLight);

    //
    // Stage lights
    //
    // Spot lights
    // Positions
    lightHeight = 5;
    positionsArray = [
        [3.8, lightHeight, -2],
        [3.8, lightHeight, 2],
        [-3.8, lightHeight, -2],
        [-3.8, lightHeight, 2],
        [0, lightHeight, 4],
        [0, lightHeight, -4]
    ];
    positionsArray.forEach((position) => {
        const light = new THREE.SpotLight({
            //color: 0xFF0000
        });
        light.position.set(position[0], position[1], position[2]);
        light.color.set(sceneProperties.stageAreaLightColor);
        light.intensity = .5 * intensityAdjustment;
        light.angle = Math.PI / 7; 
        light.penumbra = 0.25; 
        light.decay = 0; 
        light.distance = 9;
        light.castShadow = true;
        light.target.position.set(0, 0, 0);
        light.name = "Stage Spot"
        scene.add(light.target);
        scene.add(light);
        //const lightHelper = new THREE.SpotLightHelper(light);
        //scene.add(lightHelper);
    });
    // Point lights
    // Positions
    lightHeight = 2;
    positionsArray = [
        [2, lightHeight, -2.48],
        [2, lightHeight, 2.48],
        [-2, lightHeight, -2.48],
        [-2, lightHeight, 2.48]
    ];
    positionsArray.forEach((position) => {
        const light = new THREE.PointLight({
            //color: 0xFF0000
        });
        light.position.set(position[0], position[1], position[2]);
        light.color.set(sceneProperties.stageAreaLightColor);
        light.intensity = 1 * intensityAdjustment;
        light.distance = 10;
        light.decay = 1;
        light.name = "Stage Point"
        //light.castShadow = true; // Too many lights with shadows crashes the scene (CPU error)
        scene.add(light);
        //const lightHelper = new THREE.PointLightHelper(light);
        //scene.add(lightHelper);
    });
    
    //
    // Main lights
    //
    // Point lights
    // Positions
    lightHeight = 2;
    positionsArray = [
        [-7.2, lightHeight, -8],
        [-7.2, lightHeight, -2.48],
        [-7.2, lightHeight, 2.48],
        [-7.2, lightHeight, 7.3],
        [-7.2, lightHeight, 11.33],
        [-1.97, lightHeight, -8],
        [-1.97, lightHeight, 7.3],
        [-1.97, lightHeight, 11.33],
        [1.98, lightHeight, -8],
        [1.98, lightHeight, 7.3],
        [1.98, lightHeight, 11.33],
        [7, lightHeight, -8],
        [7, lightHeight, -2.48],
        [7, lightHeight, 2.48],
        [7, lightHeight, 7.3],
        [7, lightHeight, 11.33],

    ];
    positionsArray.forEach((position) => {
        const light = new THREE.PointLight({
            //color: 0xFF0000
        });
        light.position.set(position[0], position[1], position[2]);
        light.color.set(sceneProperties.mainAreaLightColor);
        light.intensity = 1 * intensityAdjustment;
        light.distance = 10;
        light.decay = 1;
        light.name = "Main Point"
        //light.castShadow = true; // Too many lights with shadows crashes the scene (CPU error)
        scene.add(light);
        //const lightHelper = new THREE.PointLightHelper(light);
        //scene.add(lightHelper);
    });


    //
    // GLTFs
    //
    // loadGLTFModel('./models/floors.gltf', true, true);
    // loadGLTFModel('./models/walls.gltf', true, true);
    loadGLTFModel('./models/mockup.gltf', true, true);

    let track_lights;
    gltfLoader.load('./models/track_lights.gltf', (gltf) => {
        track_lights = gltf.scene;
        track_lights.traverse((child) => {
            if (child.isMesh) {
                if (child.material.name.includes("Building - Ceiling - Light - Emissive - Main Area")) {
                    child.material = materialEmissive_main;
                }
                if (child.material.name.includes("Building - Ceiling - Light - Emissive - Stage Area")) {
                    child.material = materialEmissive_stage;
                }
            }
        });
        scene.add(track_lights);
    });

    let audience_seating;
    gltfLoader.load('./models/audience_seating.gltf', (gltf) => {
        audience_seating = gltf.scene;
        audience_seating.traverse((child) => {
            if (child.isMesh) {
                //child.castShadow = true;
                //child.receiveShadow = true;  // Let the plane receive shadows
                // if (child.material.name.includes("Building - Furniture - Audience Tablecloth")) {
                //     child.material = materials.material_audienceTablecloth;
                // }
                // if (child.material.name.includes("Building - Furniture - Audience Chair - Fabric")) {
                //     child.material = materials.material_audienceChair;
                // }
                // if (child.material.name.includes("Building - Furniture - Audience Chair - Fabric")) {
                //     child.material = materials.material_audienceChair;
                // };
                
                // if (child.material.name.includes("Building - Furniture - Audience Chair - Frame")) {
                //     child.material = materials.material_audienceChairFrame;
                // }
            }
        });
        scene.add(audience_seating);
    });

    // let test;
    // gltfLoader.load('./models/test.gltf', (gltf) => {
    //     test = gltf.scene;
    //     test.traverse((child) => {
    //         console.log(child);
    //     });
    //     scene.add(test);
    // });

    //
    // Geometry
    //
    //const modelGroup = new THREE.Group();

    
    // 
    // Controls
    // 
    controlsPointerLock = new PointerLockControls( camera, document.body );
    controlsOrbit = new OrbitControls(camera, renderer.domElement);
    controlsPointerLock.enabled = false;  // Disable OrbitControls by default.
    let ignoreMouseClick = true;

    const walkButton = createWalkButton();
    walkButton.addEventListener('click', function() {
        camera.position.y = walkHight;
        controlsPointerLock.lock();
        controlsOrbit.enabled = false;

    });
    const saveButton = saveSettingsButton();
    saveButton.addEventListener('click', function() {
          updateURLWithProperties(sceneProperties);
    });

    // listeners to help transition between orbit and pointerlock
    controlsPointerLock.addEventListener( 'unlock', function () {
        ignoreMouseClick = false;
    } );
    let cameraDirection, target;
    document.addEventListener('mousedown', function() {
        if (!controlsPointerLock.isLocked && !ignoreMouseClick) {
            controlsOrbit.target.copy(target);
            controlsOrbit.update();
            controlsOrbit.enabled = true;
            ignoreMouseClick = true;
        }
    });
    document.addEventListener('mousemove', function() {
        if (!controlsPointerLock.isLocked && !ignoreMouseClick) {
            cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            target = new THREE.Vector3();
            target.addVectors(camera.position, cameraDirection);
            controlsOrbit.enabled = true;
        }
    });

    document.addEventListener('keydown', function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'KeyQ':
                moveUp = true;
                break;
            case 'KeyE':
                moveDown = true;
                break;
        }
    });

    document.addEventListener('keyup', function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
            case 'KeyQ':
                moveUp = false;
                break;
            case 'KeyE':
                moveDown = false;
                break;
        }
    });
    
    stats = new Stats();
    //container.appendChild( stats.dom );





    //
    // Gui
    //
    const gui = new GUI();

    // Stage
    const guiLightsFolder = gui.addFolder('Lights');
    const guiLightsSettings = {
        'Stage area color': sceneProperties.stageAreaLightColor,
        'Main area color': sceneProperties.mainAreaLightColor
        //'Platform Visibility': true
    };
    guiLightsFolder.addColor(guiLightsSettings, 'Stage area color').onChange((value) => {
        sceneProperties.stageAreaLightColor = value;
        scene.traverse(function(object) {
            if (object.isLight) {
                if (object.name.includes("Stage")) {
                    object.color.set(value);
                }
            }
        });
        materialEmissive_stage.color.set(value);
        track_lights.traverse(function (child) {
            if (child.isMesh) {
                let materialEmissive_stage = new THREE.MeshStandardMaterial({
                    color: value,
                    emissive: value,
                    name: "Stage"
                });
                if (child.material.name.includes("Stage")) {
                    child.material = materialEmissive_stage;
                }
            }
        });
    });
    guiLightsFolder.addColor(guiLightsSettings, 'Main area color').onChange((value) => {
        sceneProperties.mainAreaLightColor = value;
        scene.traverse(function(object) {
            if (object.isLight) {
                if (object.name.includes("Main")) {
                    object.color.set(value);
                }
            }
        });
        materialEmissive_main.color.set(value);
        track_lights.traverse(function (child) {
            if (child.isMesh) {
                let materialEmissive_main = new THREE.MeshStandardMaterial({
                    color: value,
                    emissive: value,
                    name: "Main"
                });
                if (child.material.name.includes("Main")) {
                    child.material = materialEmissive_main;
                }
            }
        });
    });

    gui.close();

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize( width, height );

    composer.setSize( width, height );
}

function animate() {
    requestAnimationFrame(animate);
    
    // Pointer lock
    const time = performance.now();

    if (controlsPointerLock.isLocked) {

        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        if (moveUp && camera.position.y < maxWalkHeight) {
            camera.position.y += 0.1;  // Adjust this value to control the speed of upward movement
        }
        if (moveDown && camera.position.y > minSitHeight) {
            camera.position.y -= 0.1;  // Adjust this value to control the speed of downward movement
        }

        controlsPointerLock.moveRight(-velocity.x * delta);
        controlsPointerLock.moveForward(-velocity.z * delta);
    } else {
        
    }


    

    prevTime = time;

    // --

    // stats.begin();
    // composer.render();
    // stats.end();
    render();
}



// Start function
function start() {
    init();
    animate();
}

function render() {
    renderer.render(scene, camera);
}

// Initialize everything
start();
