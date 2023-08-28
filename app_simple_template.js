import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

//
// Globals
//
let container, stats, clock, axesHelper;
let scene, camera, renderer, controlsPointerLock, controlsOrbit;
let composer, renderPass, saoPass;

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

//let output = SAOPass.OUTPUT.Default;
let output = SAOPass.OUTPUT.Beauty;
let saoBias = 0.5;
let saoIntensity = 0.05;
let saoScale = 1;
let saoKernelRadius = 100;
let saoMinResolution = 0;
let saoBlur = true;
let saoBlurRadius = 8;
let saoBlurStdDev = 4;
let saoBlurDepthCutoff = 0.01;

const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,  // White color
    roughness: 0.5,   // Middle ground roughness
    metalness: 0.5,   // Middle ground metalness
    //envMapIntensity: 1,  // Assuming you might use an environment map. Adjust as needed.
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
    camera.position.x = 3;
    camera.position.z = 7;
    camera.position.y = 5;
    camera.lookAt(0, 0, 0);

    // 
    // Lights
    // 
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.PointLight( 0xffffff, 500 );
    directionalLight.position.set(10, 10, 10);
    directionalLight.shadow.mapSize.width = 512; // default: 256
    directionalLight.shadow.mapSize.height = 512; // default: 256
    directionalLight.shadow.camera.near = 0.5; // default
    directionalLight.shadow.camera.far = 500 // default
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    //
    // Geometry
    //
    const modelGroup = new THREE.Group();

    // Plane
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    //const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const planeMesh = new THREE.Mesh(planeGeometry, defaultMaterial);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.receiveShadow = true;
    modelGroup.add(planeMesh);

    // Cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    //const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cubeMesh = new THREE.Mesh(cubeGeometry, defaultMaterial);
    cubeMesh.castShadow = true;
    cubeMesh.position.y = .5;
    cubeMesh.castShadow = true;
    cubeMesh.receiveShadow = true;
    modelGroup.add(cubeMesh);

    // Add model group to scene
    scene.add(modelGroup);

    
    // 
    // Controls
    // 
    controlsPointerLock = new PointerLockControls( camera, document.body );
    controlsOrbit = new OrbitControls(camera, renderer.domElement);
    controlsPointerLock.enabled = false;  // Disable OrbitControls by default.
    let ignoreMouseClick = true;

    const lockButton = createWalkButton();
    lockButton.addEventListener('click', function() {
        controlsPointerLock.lock();
        controlsOrbit.enabled = false;

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
    // Post rendering (composer)
    //
    composer = new EffectComposer( renderer );
    renderPass = new RenderPass( scene, camera );
    composer.addPass( renderPass );
    saoPass = new SAOPass( scene, camera, false, true );
    composer.addPass( saoPass );
    const outputPass = new OutputPass();
    composer.addPass( outputPass );

    saoPass.params.output = output;
    saoPass.params.saoBias = saoBias;
    saoPass.params.saoIntensity = saoIntensity;
    saoPass.params.saoScale = saoScale;
    saoPass.params.saoKernelRadius = saoKernelRadius;
    saoPass.params.saoMinResolution = saoMinResolution;
    saoPass.params.saoBlur = saoBlur;
    saoPass.params.saoBlurRadius = saoBlurRadius;
    saoPass.params.saoBlurStdDev = saoBlurStdDev;
    saoPass.params.saoBlurDepthCutoff = 0.01;

    // Init gui
    const gui = new GUI();
    const sceneSettingsFolder = gui.addFolder('Scene Settings');
    const postProcessingFolder = gui.addFolder('Post Processing');

    const sceneSettings = {
        'Show AxesHelper': true
    };

    sceneSettingsFolder.add(sceneSettings, 'Show AxesHelper').onChange((value) => {
        axesHelper.visible = value; // Toggle visibility
    });

    postProcessingFolder.add( saoPass.params, 'output', {
        'Beauty': SAOPass.OUTPUT.Beauty,
        'Beauty+SAO': SAOPass.OUTPUT.Default//,
    } ).onChange( function ( value ) {

        saoPass.params.output = parseInt( value );

    } );
    postProcessingFolder.add( saoPass.params, 'saoBias', - 1, 1 );
    postProcessingFolder.add( saoPass.params, 'saoIntensity', 0, 1 );
    postProcessingFolder.add( saoPass.params, 'saoScale', 0, 10 );
    postProcessingFolder.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    postProcessingFolder.add( saoPass.params, 'saoMinResolution', 0, 1 );
    postProcessingFolder.add( saoPass.params, 'saoBlur' );
    postProcessingFolder.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    postProcessingFolder.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    postProcessingFolder.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );

    gui.close();
    // sceneSettingsFolder.close();
    postProcessingFolder.close();

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

        if (moveUp && camera.position.y < 8) {
            camera.position.y += 0.1;  // Adjust this value to control the speed of upward movement
        }
        if (moveDown && camera.position.y > 2.5) {
            camera.position.y -= 0.1;  // Adjust this value to control the speed of downward movement
        }

        controlsPointerLock.moveRight(-velocity.x * delta);
        controlsPointerLock.moveForward(-velocity.z * delta);
    } else {
        
    }


    

    prevTime = time;

    // --

    stats.begin();
    composer.render();
    stats.end();
}

function render() {
    composer.render();
}

// Start function
function start() {
    init();
    animate();
}

// Initialize everything
start();
