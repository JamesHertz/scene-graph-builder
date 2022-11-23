import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten , vec3, normalMatrix, rotateX, rotateY, mult, vec4, perspective} from "../libs/MV.js";

import { RotationY, SceneGraph, Translation } from "./sg-builder.js";
import * as SPHERE from '../libs/objects/sphere.js'
import * as CUBE from '../libs/objects/cube.js';
import * as CYLINDER from '../libs/objects/cylinder.js'
import * as TORUS from '../libs/objects/torus.js'
import * as dat from '../libs/dat.gui.module.js'

/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)

let last_time = undefined

let time = 0;

let speed = 0;

const axono_pars = {
    theta: 60,
    gama: 15
}

const primitives = {
    'sphere': SPHERE,
    'cube': CUBE,
    'cylinder': CYLINDER,
    'torus': TORUS
}

const basic_cameras = {
    front: lookAt([0, 0, 100], [0, 0, 0], [0,1,0]), 
    top: lookAt([0, 100, 0], [0, 0, 0], [0,0,-1]),
    right: lookAt([100, 0, 0], [0, 0, 0], [0,1,0]),
}


// some constants related to the helicopter
const MAX_SLOPE_ANGLE = 30,
      MAX_SPEED = -3.6,
      MAX_HEIGHT = 20,
      MIN_HEIGHT = 0,
      MIN_FLY_HEIGHT = Math.tan(Math.PI * MAX_SLOPE_ANGLE / 180)*2 


// helicopter infos
// clean up this thing later
let h_height = MIN_HEIGHT
let h_angle = 0
let h_forward_speed = 0
let h_slope_angle = 0

// following camera initial eye and at
const EYE = vec4(-10, 0, 0, 1), AT = vec4(0, 0, 0, 1)

/*

the idea is to have something that will always come to zero
but what we can do is to change it.


problems to solve:
    when we are in up view we need to change the projection matrix
    to capture a wider area..


problem:
    For certain Mview I would love to have differents
    mProjection.
    The problem of having different mProjection is that 
    we need to switch for the current one when needed,
    and when resizing the window we need to calculate the 
    value for the right one


function defaultMProjection(){
    // returns the default one
}

function topCameraMProjection(){
    // returns the mProj for the top camera
}

function followingCameraMProjection(){
    // returns the mProj for the following camera
}
// two problems how to switch when I switch camera?
{
    function switchMProjection(newFunc){
        mProjFunc = newFunc
        mProjection = mProjFunc()
    }
    ....
    if(mProjFunc != defaulMProjection && ...)
        switchmProjection(defaultmProjection)
    

}

*/

const pressed_keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false
}


// IDEA: when we are not in the camera 1 we shouldn't be
// able to these parameters
function setupControllers(){
    const gui = new dat.GUI({name: 'parameters'})
    const folder = gui.addFolder('axonometric parameters')
    folder.add(axono_pars, 'gama', -90, 90)
    folder.add(axono_pars, 'theta', -90, 90)


    gui.open()
    folder.open()

    // to prevent unwanted results
    // For example if we are chaging the game or the beta using the keyboard
    // we surely don't want it to change the camera to front, up or right
    gui.domElement.addEventListener('keydown', e => e.stopPropagation())
    gui.domElement.addEventListener('keyup', e => e.stopPropagation())
}



function setup([shaders, scene_desc])
{

    const scene_graph = new SceneGraph(scene_desc, Object.keys(primitives))
    const helicopter = scene_graph.findNode('helicopter')
    const tail_helices = scene_graph.findNode('helicopter/tail/tail-helices')
    const upper_helices = scene_graph.findNode('helicopter/upper-helices')

    const heli_height = helicopter.addTransformation(new Translation([0, 0, 0]))
    const heli_forward = helicopter.addTransformation(new RotationY(0))
    

    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    let rout_angle = 0

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let Mview = getAxonoMatrix()

    let mProjection;

    let mProjFunc = defaultMProjection 

    mode = gl.TRIANGLES

    for(let fig of [SPHERE, CUBE, CYLINDER, TORUS]) fig.init(gl)

    resize_canvas()
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    setupControllers()
   
    // this is to prevent the camera to change when
    // you are typing the angle on the dat.gui input box.

    window.addEventListener('keydown', e => {
        switch(e.key){
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
                //Mview = lookAt([100, 0, 0], [0, 0, 0], [0,1,0])
                setMview(basic_cameras.right)
                break
            case '5':
                setMview(getFollowMatrix(), followCameraMProjection)
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

    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;
        mProjection = mProjFunc()
        gl.viewport(0,0,canvas.width, canvas.height);
    }

    function setMview(newMview, newMProjFunc=defaultMProjection){
        Mview = newMview
        if(newMProjFunc != mProjFunc){
            mProjFunc = newMProjFunc
            mProjection = mProjFunc()
        }
    }


    // define the mProjections functions
    function defaultMProjection(){
        return ortho(-30 * aspect, 30 * aspect, -30, 30, 1, 200) 
    }

    function topCameraMProjection(){
        return ortho(-40 * aspect, 40 * aspect, -40, 40, 1, 200) 
    }
    function followCameraMProjection(){
        return perspective(80, aspect, 5, 200) 
    }


    function draw(primitive, modelViewMatrix, color){

        const mNormal = normalMatrix(modelViewMatrix, true)

        // upload color
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)
        // upload model matrix
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelViewMatrix));
        // upload normal matrix 
        gl.uniformMatrix3fv(gl.getUniformLocation(program, "mNormal"), false, flatten(mNormal));
        // upload the lightOn (which means should I use illumination or not)
        gl.uniform1i(gl.getUniformLocation(program, "uLightOn"), mode == gl.LINES ? 0 : 1)

        primitives[primitive].draw(gl, program, mode)
    }

    function getAxonoMatrix(){
        const {theta, gama} = axono_pars
        const result = mult( 
            basic_cameras.front,
            mult( rotateX(gama), rotateY(theta) )
        )
        result.axono = true
        return result
    }

    function getFollowMatrix(){
        const heliModel = helicopter.modelMatrix
        const eye = vec3(mult(heliModel, EYE))
        const at =  vec3(mult(heliModel, AT))
        eye[1] = at[1] + 10 // TODO: make this a constant

        const result = lookAt(eye, at, [0, 1, 0])
        result.follow = true
        return result
    }

    function render(timestamp)
    {
        if(last_time == undefined) time = 0
        else{
            speed = (timestamp - last_time) / 60
            time +=  speed
        } 

        last_time = timestamp

        // if we want to do some physics here is the place :)
        rout_angle = (h_height > MIN_HEIGHT) ? time * 2 * Math.PI * 8 : 0

        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
 
        // think about this later?
        // would it better to use acceleration?
        if(pressed_keys.ArrowLeft && h_height > MIN_FLY_HEIGHT){
            h_forward_speed = Math.max(h_forward_speed - 0.1,  MAX_SPEED)
        }

        if(h_forward_speed){
            h_forward_speed = Math.min(0, h_forward_speed + 0.025)
            h_angle += h_forward_speed 
        }

        h_slope_angle = h_forward_speed/MAX_SPEED * 30
   
        if(pressed_keys.ArrowUp) {
            h_height = Math.min(h_height + speed, MAX_HEIGHT)
        }

        if(pressed_keys.ArrowDown) {
            const min_h = (h_slope_angle> 0) ? MIN_FLY_HEIGHT : MIN_HEIGHT 
            h_height = Math.max(h_height - speed, min_h)
        }

        upper_helices.rotationY = rout_angle
        tail_helices.rotationZ = rout_angle
        heli_forward.value = h_angle
        helicopter.rotationZ = h_slope_angle
        heli_height.value = [0, h_height, 0]

        // lookAt(eye, at, up)
        if(Mview.follow) Mview = getFollowMatrix()
        if(Mview.axono) Mview = getAxonoMatrix()

        scene_graph.drawScene(draw, Mview)
    }
}

const urls = ["shader.vert", "shader.frag"];
Promise.all([
    loadShadersFromURLS(urls),
    fetch('scene-graph.json').then(sg => sg.json())
]).then(setup)