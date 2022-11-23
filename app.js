import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten , vec3, normalMatrix, rotateX, rotateY, mult, vec4, inverse, translate} from "../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale} from "../libs/stack.js";

import { SceneGraph } from "./sg-builder.js";
import * as SPHERE from '../libs/objects/sphere.js'
import * as CUBE from '../libs/objects/cube.js';
import * as CYLINDER from '../libs/objects/cylinder.js'
import * as TORUS from '../libs/objects/torus.js'
import * as dat from '../libs/dat.gui.module.js'
import { multRotationX, multRotationZ, multTranslation, popMatrix, pushMatrix } from "../libs/stack.js";

//import * as PYRAMID from '../../libs/objects/pyramid.js'


/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)

let last_time = undefined

let time = 0;

let speed = 0;

const colors = {
    red: vec3(1, 0, 0),
    yellow: vec3(1, 1, 0),
    blue: vec3(0, 0, 1),
    grey: vec3(0.5, 0.5, 0.5),
    green: vec3(0, 1, 0)
}

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
    // ask about this...
    top: lookAt([0, 100, 0], [0, 0, 0], [0,0,-1]),
    right: lookAt([100, 0, 0], [0, 0, 0], [0,1,0]),
}


const MAX_SLOPE_ANGLE = 30,
      MAX_SPEED = -3.6,
      MAX_HEIGHT = 20,
      MIN_HEIGHT = 2.25,
      MIN_FLY_HEIGHT = Math.tan(Math.PI * MAX_SLOPE_ANGLE / 180)*2 + MIN_HEIGHT


// helicopter infos
// clea up this thing later
let h_height = MIN_HEIGHT
let h_angle = 0
let h_forward_speed = 0
let h_slope_angle = 0

const EYE = vec4(-5, 0, 0, 1), AT = vec4(0, 0, 0, 1)


/*

the idea is to have something that will always come to zero
but what we can do is to change it.


problems to solve:
    when we are in up view we need to change the projection matrix
    to capture a wider area..

    I sort of invented a very trick way to change the height but
    what we actually have to do is to keep increasing the height
    while the key is pressed.


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
    // For example if we are chaing the game or the beta using the keyboard
    // we surely don't want it to change the camera to front, up or right
    gui.domElement.addEventListener('keydown', e => e.stopPropagation())
    gui.domElement.addEventListener('keyup', e => e.stopPropagation())
}

function getFollowMatrix(heliModel){
    const eye = vec3(mult(heliModel, EYE))
    const at =  vec3(mult(heliModel, AT))

    const result = lookAt(eye, at, [0, 1, 0])
    result.follow = true
    return result
}

function setup([shaders, scene_desc])
{

    const scene_graph = new SceneGraph(scene_desc, Object.keys(primitives))

    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    let rout_angle = 0

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let Mview = getAxonoMatrix()

    let mProjection;
    let heliModelView;
    let heliModel;

    

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
                Mview = getAxonoMatrix()
                break
            case '2':
                //Mview = lookAt([0, 0, 100], [0, 0, 0], [0,1,0])
                Mview = basic_cameras.front
                break
            case '3':
                //Mview = lookAt([0, 100, 0], [0, 0, 0], [0,0,-1])
                Mview = basic_cameras.top
                break
            case '4':
                //Mview = lookAt([100, 0, 0], [0, 0, 0], [0,1,0])
                Mview = basic_cameras.right
                break
            case '5':
                //Mview = lookAt([100, 100, 100], [0, 0, 0], [0,1,0])
                Mview = getFollowMatrix(heliModel)
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

        const value = 30
        aspect = canvas.width / canvas.height;
        mProjection = ortho(-value * aspect, value * aspect, -value, value, 1, 200) 
        gl.viewport(0,0,canvas.width, canvas.height);
    }


    function draw(primitive, modelMatrix, color=colors.red){

        const mNormal = normalMatrix(modelMatrix, true)

        // upload color
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)
        // upload model matrix
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelMatrix));
        // upload normal matrix 
        gl.uniformMatrix3fv(gl.getUniformLocation(program, "mNormal"), false, flatten(mNormal));

        primitives[primitive].draw(gl, program, mode)
    }

    function tiny_helice(){
        multScale([1, 0.3, 0.15])
        draw(SPHERE, colors.blue)
    }

    function helice(){
        multScale([4, 0.4, 0.4])
        draw(SPHERE, colors.blue)
    }
    
    function upper_helice_junction(){
        multScale([0.3, 0.6, 0.3])
        draw(CYLINDER, colors.yellow)
    }

    function body(){
        multScale([5, 3, 3])
        draw(SPHERE)
    }

    function upper_helices(){
        pushMatrix()  
            upper_helice_junction()
        popMatrix()
        pushMatrix()  
            multTranslation([-2, 0, 0])
            helice()
        popMatrix()
        pushMatrix()  
            multTranslation([1, 0, 1.75])
            multRotationY(120)
            helice()
        popMatrix()
            multTranslation([1, 0, -1.75])
            multRotationY(240)
            helice()
    }
    
    function front_tail(){
        multScale([5, 0.8, 0.35])
        draw(SPHERE)
    }

    function tail_helice_junction(){
        multRotationX(90)
        multScale([0.2, 0.1, 0.2])
        draw(CYLINDER, colors.yellow)
    }

    function tail_helices(){
        pushMatrix()
            tail_helice_junction()
        popMatrix()
        pushMatrix()
            multTranslation([0.45, 0, 0])
            tiny_helice()
        popMatrix()
        pushMatrix()
            multTranslation([-0.45, 0, 0])
            tiny_helice()
        popMatrix()
    }

    function back_tail(){
        multRotationZ(15)
        multScale([0.6, 1, 0.2])
        draw(SPHERE)
    }

    function tail(){
        pushMatrix()
            front_tail()
        popMatrix()
        pushMatrix()
            multTranslation([-2.2, 0.3, 0])
            back_tail()
        popMatrix()
            multTranslation([-2.25, 0.4, 0.1])
            multRotationZ(rout_angle)
            tail_helices()  //Helices pequenas agarradas ao cilindro
        
    }

    // rename this later
    function bp_support(){
        multScale([0.2, 1, 0.2])
        draw(CUBE, colors.grey)
    }

    function single_bear_paw(){
        pushMatrix()  
            multRotationZ(15)
            multTranslation([1, 0, 0])
            bp_support()
        popMatrix()
        pushMatrix()  
            multRotationZ(-15)
            multTranslation([-1, 0, 0])
            bp_support()
        popMatrix()
            multTranslation([0, -0.25, 0])
            multRotationY(90)
            multRotationX(90)
            multScale([0.3, 4, 0.3])
            draw(CYLINDER, colors.yellow)
        
    }

    function bearpaws(){
        pushMatrix()
            multTranslation([0, 0, -0.77])
            multRotationX(30)
            single_bear_paw()
        popMatrix()
            multTranslation([0, 0, 0.77])
            multRotationX(-30)
            single_bear_paw()
    }

    function helicopter(){

        pushMatrix()
            body()         //Esfera principal
        popMatrix()

        pushMatrix()
            multTranslation([-4, 0.7, 0])
            tail()          //Cauda principal e secundaria
        popMatrix()

        pushMatrix()
            multTranslation([0, 1.75, 0])
            multRotationY(rout_angle)
            upper_helices()
        popMatrix()
            multTranslation([0, -2, 0])
            bearpaws()      //Patas do helicoptero
    }

    function floor(){
        multTranslation([0, -0.25, 0])
        multScale([ 100, 0.25, 100])
        draw(CUBE, colors.green) 
    }

    function drawScene(){
        pushMatrix()
            multRotationY(h_angle)
            multTranslation([0, h_height, 20])
            multRotationZ(h_slope_angle)
            multRotationY(180)

            heliModelView = modelView()
            helicopter()
        popMatrix()
            floor()
    }


    // others functions
    function getAxonoMatrix(){
        const {theta, gama} = axono_pars
        const result = mult( 
            basic_cameras.front,
            mult( rotateX(gama), rotateY(theta) )
        )
        result.axono = true
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

        // lookAt(eye, at, up)
        // if it is an axono matrix just recalculate it :)

        // some fun stuffs
        if(heliModelView){
            heliModel = mult(rotateY(h_forward_speed), mult( inverse(Mview), heliModelView))
        }
        
        // calc

        if(Mview.follow) Mview = getFollowMatrix(heliModel)
        if(Mview.axono) Mview = getAxonoMatrix()
        //loadMatrix(Mview)
        //drawScene() // this mess will be fixed :)
        scene_graph.drawScene(draw, Mview)
    }
}

const urls = ["shader.vert", "shader.frag"];
Promise.all([
    loadShadersFromURLS(urls),
    fetch('scene-graph.json').then(sg => sg.json())
]).then(setup)