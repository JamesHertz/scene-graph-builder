/**
 * @author James Furtado (61177)
 * @author Iago Paulo (60198)
 */
import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten , vec3, normalMatrix, rotateX, rotateY, scale, vec4, perspective, add, mult, subtract} from "../../libs/MV.js";

import { RotationY, SceneGraph, Translation } from "./sg-builder.js";
import * as SPHERE from '../../libs/objects/sphere.js'
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as TORUS from '../../libs/objects/torus.js'
import * as PYRAMID from '../../libs/objects/pyramid.js'
import * as BUNNY from '../../libs/objects/bunny.js'
import * as dat from '../../libs/dat.gui.module.js'

/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)

let last_time = undefined

let time = 0;

// the following three objects that finish in controllers
// are used to keep track of the parameters of each one of the
// cameras, also it's used to sync the parameters on the gui
// with the it's respective value that in some cases can be altered
// by moving the mouse, scrolling the mouse wheel etc.
// these objects are used below where more details are given about them.
const axonoController = {
    topic: "axono parameters", // the name of the dat.gui.folder
    pars: [ // the list of parameters the folder will have
        {name: 'theta', MIN: -180, MAX: 180, DEFAULT: 60},
        {name: 'gama', MIN: -90, MAX: 90, DEFAULT: 15}
    ],
    // it will also have another attribute:
    // - folder => the correspoding dat.gui.folder for the this controller
    // - sliders => an dictionary with the dat.gui.Controller of each parameter 
    // - container => an dictionary/object that will have the current value of each parameters
    // or more info about this check the function setupControllers

    // the descriptions above applies to all the followinc camera controllers

}

const freeCamController  = {
    topic: "free cam parameters",
    pars: [
        {name: 'theta', MIN: -180, MAX: 180, DEFAULT: 130}, 
        {name: 'gama', MIN: 0, MAX: 90, DEFAULT: 30},
        {name: 'distance', MIN: 25, MAX: 150, DEFAULT: 70},
        {name: "sensibility", MIN: 5, MAX: 10}
    ],
}

const gui_controllers = [
    axonoController,
    freeCamController
]

const WHEEL_SCROLL_SENSIBILITY = 20
// some default cameras
const basic_cameras = {
    front: lookAt([0, 0, 100], [0, 0, 0], [0,1,0]), 
    top: lookAt([0, 100, 0], [0, 0, 0], [0,0,-1]),
    right: lookAt([100, 0, 0], [0, 0, 0], [0,1,0]),
}

// it's used to keep track of the keys that are pressed 
// and the ones that are not. the way it's used if very simple
// whenever the keydown event is fired we will check if it's one this keys
// if it is we will set the corresponding key to true and we will do the
// analogous thing when the keyup is fired
const pressed_keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false
}

// used by the call to the constructor of SceneGraph
// that is in sg-builder.js. Basically we are defining the
// primitives our scene will support.
const primitives = {
    'sphere': SPHERE,
    'cube': CUBE,
    'cylinder': CYLINDER,
    'torus': TORUS,
    'pyramid': PYRAMID,
    'bunny': BUNNY
}


// set's up the controllers (dat.guit sliders) and returns the
// dat.gui object that will contain these contollers (cameras sliders)
//
// we used a very trick and non-trival way of doing this
// basically we have an array of objects called gui_controllers
function setupControllers(){
    const gui = new dat.GUI({name: 'parameters'})

    for(let controller of gui_controllers){
        const {topic, pars} = controller

        const container = {}
        const sliders = {} // will store the slide for each one of the parameter
        const folder = gui.addFolder(topic)

        for(let {name, MAX, MIN, DEFAULT} of pars){
            container[name] = (DEFAULT === undefined) ? MIN : DEFAULT
            sliders[name] = folder.add(container, name,  MIN, MAX)
        }

        folder.open()

        /*
            equivalent to:
                controller.container = container
                controller.folder = folder
                controller.sliders = sliders
        */
        Object.assign(controller, {container, folder, sliders})
    }

    gui.open()


    // to prevent unwanted results
    // For example if we are chaging the game or the beta using the keyboard
    // we surely don't want it to change the camera to front, up or right
    for(let event of ['keydown', 'keyup']){

        gui.domElement.addEventListener(event, e => {
            e.stopPropagation()
        })
    }
    return gui
}

function setup([shaders, scene_desc])
{
    const scene_graph = new SceneGraph(scene_desc, Object.keys(primitives))

    const gui = setupControllers()

    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let Mview; 
    let mProjection;

    // since we want to have differents cameras hence different Mview
    // and also we want some of them to have different projection matrix
    // this one is used to recalculate the current mProjection choosed
    let mProjFunc; 

    // used to set the modelView and the respective mProjection
    setMview(getFreeCamMatrix(), followCameraMProjection)

    mode = gl.TRIANGLES

    // init's the primitives/figures/objects on the folder libs/objects
    for(let key in primitives) primitives[key].init(gl)

    resize_canvas()
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    window.addEventListener('keydown', e => {
        switch(e.key){
            case '0': // free camera
                setMview(getFreeCamMatrix(), followCameraMProjection)
                break
            case '1':
                setMview(getAxonoMatrix())
                break
            case '2':
                setMview(basic_cameras.front)
                break
            case '3':
                setMview(basic_cameras.top, topCameraMProjection)
                break
            case '4':
                setMview(basic_cameras.right)
                break
            case 'w':
                mode = gl.LINES
                break

            case 's':
                mode = gl.TRIANGLES
                break

            default:
                if(e.key in pressed_keys)
                    pressed_keys[e.key] = true
        }
    })


    window.addEventListener('keyup', e => {
        if(e.key in pressed_keys)
            pressed_keys[e.key] = false
    })

    // we used canvas to avoid problems while change the parameters
    // on the dat.gui sliders.
    // this listener change the parameters of free cam
    // when such is selected and we click and move our mouse
    canvas.addEventListener("mousedown", e => {
        if(!Mview.freeCam) return 

        let oldX = e.screenX
        let oldY = e.screenY
        
        function update_pars(event){
            // check if still pressed if not return
            if(event.buttons == 0){
                window.removeEventListener('mousemove', update_pars)
                return 
            }

            let dx = oldX - event.screenX
            let dy = oldY - event.screenY

            const {sliders, container, pars}  = freeCamController
            const {sensibility} = container

            // making it possible to rotation 360 degrees :)
            const {MAX, MIN} = pars.find(n => n.name == 'theta') 
            let newtheta = container.theta - dx/sensibility
            if(newtheta > MAX) newtheta = MIN
            else if(newtheta < MIN) newtheta = MAX

            sliders.theta.setValue(newtheta)

            sliders.gama.setValue(
                container.gama - dy/sensibility
            )

            oldX = event.screenX
            oldY = event.screenY
        }

        window.addEventListener('mousemove', update_pars)
    })

    // used to set the distance on the free Cam of the 
    // follow camera when we scrool the mouse wheel 
    // we used two fingers on the mouse pad to scrool the page :)
    window.addEventListener("wheel", e => {
        if(Mview.freeCam || Mview.follow){
            let controller = Mview.freeCam ? freeCamController : followCamController
            const {container, sliders} = controller
            sliders.distance.setValue(
                container.distance + e.deltaY/WHEEL_SCROLL_SENSIBILITY
            )
        }

    })

    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;
        mProjection = mProjFunc()
        gl.viewport(0,0,canvas.width, canvas.height);
    }

    // get's the folder of the camera being selected
    // we use to this to only display the sliders of
    // the current selected camera and if such camera doesn't
    // have sliders we don't display any slider
    function getSelCamFolder(){
        if(Mview.axono) return axonoController.folder
        if(Mview.freeCam) return freeCamController.folder

        return null
    }

    function setMview(newMview, newMProjFunc=defaultMProjection){
        Mview = newMview
        if(newMProjFunc != mProjFunc){
            mProjFunc = newMProjFunc
            mProjection = mProjFunc()
        }
        // get's the current camera folder
        const selFolder = getSelCamFolder()

        // hides all folders
        for(let {folder} of gui_controllers)
            folder.hide()

        // shows the one that belongs to the current camera
        // it such camera has any sliders
        if(selFolder) {
            gui.show()
            selFolder.show()

        // hides the gui because these particular camera doesn't 
        // have any sliders for it's parameters
        }else gui.hide() 
    }


    // we define some mProjections functions
    function defaultMProjection(){
        return ortho(-30 * aspect, 30 * aspect, -30, 30, 1, 400) 
    }

    function topCameraMProjection(){
        return ortho(-50 * aspect, 50 * aspect, -50, 50, 1, 400) 
    }

    // follow camera and freeCam
    function followCameraMProjection(){
        return perspective(80, aspect, 5, 300) 
    }


    // used by the SceneGraph call to the function drawScene
    // where primitive is a string with the name of one of the primitives
    // we've stated we support when we sent it in it's constructor (ScaneGraph's)
    function draw(primitive, modelViewMatrix, color){

        // after a bit of search I found this to be helpful
        // the full explantion of this is found in the fragment shader
        const mNormal = normalMatrix(modelViewMatrix, true)

        // upload color
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)
        // upload modelView matrix
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelViewMatrix));
        // upload normal matrix 
        gl.uniformMatrix3fv(gl.getUniformLocation(program, "mNormal"), false, flatten(mNormal));
        // upload the lightOn (which means should I use illumination or not)
        gl.uniform1i(gl.getUniformLocation(program, "uLightOn"), mode == gl.LINES ? 0 : 1)

        primitives[primitive].draw(gl, program, mode)
    }
    
    // functions used to calculate some of the cameras 
    // (the dynamic ones/the ones that has parameters that can be changed
    //  by the user)
    function getFreeCamMatrix(){
        const {theta, gama, distance} = freeCamController.container 
        const result = mult( 
            lookAt([0, 0, distance], [0, 0, 0], [0, 1, 0]),
            mult( rotateX(gama), rotateY(theta) )
        )
        result.freeCam = true
        return result
    }

    function getAxonoMatrix(){
        const {theta, gama} = axonoController.container 
        const result = mult( 
            basic_cameras.front,
            mult( rotateX(gama), rotateY(theta) )
        )
        result.axono = true
        return result
    }



    function render(timestamp)
    {
        let delta_time = 0;

        if(last_time == undefined) time = 0
        else{
            delta_time = (timestamp - last_time) / 1000
            time += delta_time 
        } 

        last_time = timestamp

        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));


        // lookAt(eye, at, up)
        // if one of the dynamic cameras/the ones the user can change the parameters
        // is being used, we need to recalculate it.
        if(Mview.axono) Mview = getAxonoMatrix()
        else if (Mview.freeCam) Mview = getFreeCamMatrix()

        // draws the scene
        scene_graph.drawScene(draw, Mview)
    }
}

const urls = ["shader.vert", "shader.frag"];
Promise.all([
    loadShadersFromURLS(urls),
    // get's the file scene-graph.json and parses it to json
    fetch('scene-graph.json').then(sg => sg.json()) 
]).then(setup)