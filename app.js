import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten , vec3, normalMatrix, rotateX, rotateY, scale, vec4, perspective, add, mult, subtract} from "../libs/MV.js";

import { RotationY, SceneGraph, Translation } from "./sg-builder.js";
import * as SPHERE from '../libs/objects/sphere.js'
import * as CUBE from '../libs/objects/cube.js';
import * as CYLINDER from '../libs/objects/cylinder.js'
import * as TORUS from '../libs/objects/torus.js'
import * as PYRAMID from '../libs/objects/pyramid.js'
import * as BUNNY from '../libs/objects/bunny.js'
import * as dat from '../libs/dat.gui.module.js'

/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)

let last_time = undefined

let time = 0;


// constants related to axonometric camera
const axono_pars = {
    theta: 60,
    gama: 15
}

const follow_pars = {
    distance: 10
}

const free_pars = {
    ...axono_pars,
    distance: 100
}

const axono_gui = {
    topic: "axono parameters",
    container: axono_pars,
    pars: [
        {name: 'theta', MIN: -180, MAX: 180},
        {name: 'gama', MIN: -90, MAX: 90}
    ]
}

const follow_gui = {
    topic: "follow camera parameters",
    container: follow_pars,
    pars: [
        {name: 'distance', MIN: 10, MAX: 20}
    ]
}

const free_gui = {
    topic: "free cam parameters",
    container: free_pars,
    pars: [
        {name: 'theta', MIN: -180, MAX: 180},
        {name: 'gama', MIN: 0, MAX: 90},
        {name: 'distance', MIN: 25, MAX: 200}
    ]
}

const gui_controllers = [
    axono_gui,
    follow_gui,
    free_gui
]
// some default cameras
const basic_cameras = {
    front: lookAt([0, 0, 100], [0, 0, 0], [0,1,0]), 
    top: lookAt([0, 100, 0], [0, 0, 0], [0,0,-1]),
    right: lookAt([100, 0, 0], [0, 0, 0], [0,1,0]),
}

// box constants
const BOX_SIZE = 2
const BOX_LIFE = 5 // seconds
const BOX_HALF_SIZE = BOX_SIZE /2
const BOX_GRAV_CONSTANT = -98 
// the portion of the helicopeter speed the box will take 
const BOX_SPEED_FACTOR = 0.5 

const box_node = {
    scale: [BOX_SIZE, BOX_SIZE, BOX_SIZE],
    children: "medic-kit"
}

// some constants related to the helicopter
const MAX_SLOPE_ANGLE = 30
const MAX_SPEED = -200
const MAX_HEIGHT = 20
const MIN_DROPPING_HEIGHT = 3 * BOX_SIZE
const MIN_HEIGHT = 0
const MIN_FLY_HEIGHT = Math.tan(Math.PI * MAX_SLOPE_ANGLE / 180)*2 

// helicopter infos
// clean up this thing later
let h_height = MIN_HEIGHT
let h_angle = 0
let h_forward_speed = 0

// related to forward 
const pressed_keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false
}

// used by one call of a constructor
// of that is in sg-builder.js
const primitives = {
    'sphere': SPHERE,
    'cube': CUBE,
    'cylinder': CYLINDER,
    'torus': TORUS,
    'pyramid': PYRAMID,
    'bunny': BUNNY
}

// IDEA: when we are not in the camera 1 we shouldn't be
// able to these parameters
// TODO: use the .hide() to do this effect :)
function setupControllers(){
    const gui = new dat.GUI({name: 'parameters'})

    for(let {topic, container, pars} of gui_controllers){
        const folder = gui.addFolder(topic)

        for(let {name, MAX, MIN} of pars)
            folder.add(container, name,  MIN, MAX)

        folder.open()
    }

    gui.open()

    // to prevent unwanted results
    // For example if we are chaging the game or the beta using the keyboard
    // we surely don't want it to change the camera to front, up or right
    gui.domElement.addEventListener('keydown', e => e.stopPropagation())
    gui.domElement.addEventListener('keyup', e => e.stopPropagation())
}


/**
 * 
 * @param {SceneGraph} sg 
 */
function complete_scene(sg){
    const street = sg.getBaseNode('street')
    for(let i = 0; i < 50; i++){
        street.addChild(
            sg.createNode({
                translation: [0, 0, 3 * i],
                children: "street-strips"
            })
        )
    }

    const ladder = sg.getBaseNode("ladder")
    for(let i = 0; i < 9; i++){
        ladder.addChild(
            sg.createNode({
                translation: [0, i, 0],
                children: "ladder-rung"
            })
        )
    }

}

function setup([shaders, scene_desc])
{
    let boxes = [] // an array of objects {node, life, velocity}
    const scene_graph = new SceneGraph(scene_desc, Object.keys(primitives))

    complete_scene(scene_graph)

    const helicopter = scene_graph.findNode('helicopter')
    const tail_helices = scene_graph.findNode('helicopter/tail/tail-helices')
    const upper_helices = scene_graph.getBaseNode('upper-helices')
    const car_sirens = scene_graph.getBaseNode('car-sirens')

    const heli_height = helicopter.addTransformation(new Translation([0, 0, 0]))
    const heli_forward = helicopter.addTransformation(new RotationY(0))
    

    // the radius that the helicopter will be rotating
    const ROTATION_RADIUS = helicopter.translation[2]
    

    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let Mview = getAxonoMatrix()

    let mProjection;

    let mProjFunc = defaultMProjection 

    mode = gl.TRIANGLES

    for(let key in primitives) primitives[key].init(gl)

    resize_canvas()
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    setupControllers()
   
    window.addEventListener('keydown', e => {
        switch(e.key){
            case '0':
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
            case '5':
                setMview(getFollowMatrix(), followCameraMProjection)
                break
            case 'w':
                mode = gl.LINES
                break

            case 's':
                mode = gl.TRIANGLES
                break

            case ' ': // space
                // get the intial velocity
                if(h_height > MIN_DROPPING_HEIGHT)
                    boxes.push(createBox())
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

    window.addEventListener("mousedown", e => {
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

            // TODO: constraint about the borders:
            // TODO: a slice for this
            const SENSIBILITY = 5
            free_pars.theta -= dx/SENSIBILITY
            free_pars.gama -= dy/SENSIBILITY

            oldX = event.screenX
            oldY = event.screenY
        }

        window.addEventListener('mousemove', update_pars)
    })

    window.addEventListener("wheel", e => {
        if(Mview.freeCam){
            free_pars.distance += e.deltaY/20 // TODO: constant, it's the sensibility
            // do the wonderful thing :)
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

    function setMview(newMview, newMProjFunc=defaultMProjection){
        Mview = newMview
        if(newMProjFunc != mProjFunc){
            mProjFunc = newMProjFunc
            mProjection = mProjFunc()
        }
    }

    function createBox(){
        const heli_pos = mult(
            helicopter.modelMatrix,
            vec4(0, -BOX_SIZE, 0, 1) 
        )

        const angular_speed = -ROTATION_RADIUS * h_forward_speed/180 * Math.PI

        const velocity_vector = subtract(
            mult(helicopter.modelMatrix, vec4(1, 0, 0, 1)),
            mult(helicopter.modelMatrix, vec4(0, 0, 0, 1))
        )

        const velocity = vec3(
            scale(BOX_SPEED_FACTOR * angular_speed, velocity_vector)
        )

        velocity[1] = 0 // we don't want it's y coordinates
        
        const box = {
            life: BOX_LIFE,
            velocity,
            node: scene_graph.createNode({
                ...box_node, 
                translation: vec3(heli_pos)
            })
        }
        scene_graph.root.addChild(box.node)
        return box
    }

    // define the mProjections functions
    function defaultMProjection(){
        return ortho(-30 * aspect, 30 * aspect, -30, 30, 1, 400) 
    }

    function topCameraMProjection(){
        return ortho(-50 * aspect, 50 * aspect, -50, 50, 1, 400) 
    }

    function followCameraMProjection(){
        return perspective(80, aspect, 5, 200) 
    }


    function draw(primitive, modelViewMatrix, color){

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

    function getFreeCamMatrix(){
        const {theta, gama, distance} = free_pars
        const result = mult( 
            lookAt([0, 0, distance], [0, 0, 0], [0, 1, 0]),
            mult( rotateX(gama), rotateY(theta) )
        )
        result.freeCam = true
        return result
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
        const {distance} = follow_pars
        const heliModel = helicopter.modelMatrix
        const eye = vec3(mult(heliModel, vec4(-distance, 0, 0, 1)))
        const at =  vec3(mult(heliModel, vec4(0, 0, 0, 1)))
        eye[1] = at[1] + 10 // TODO: make this a constant

        const result = lookAt(eye, at, [0, 1, 0])
        result.follow = true
        return result
    }

    function evolve_boxes(delta_time){

        // the boxes that stills alive
        const rem_boxes = []
        for(let b of boxes){
            b.life -= delta_time 
            if(b.life <= 0)
                scene_graph.root.removeChild(b.node)
            else{
                rem_boxes.push(b)
                // if helicopter is not in the ground
                if(b.velocity != null){
                    b.velocity[1] += BOX_GRAV_CONSTANT * delta_time
                    let position = b.node.translation
                    position = add(position, scale(delta_time, b.velocity))

                    if(position[1] <= BOX_HALF_SIZE){
                        position[1] = BOX_HALF_SIZE
                        b.velocity= null // we've reached the ground
                    } 
                    b.node.translation = position
                }
           } 
        }
        boxes = rem_boxes
    }


    // TODO: add constants
    function evolve_scene(delta_time){

        const helices_rotation_angle = (h_height > MIN_HEIGHT) ? time * 2 * Math.PI * 100 : 0
        
        // updates the velocity
        if(pressed_keys.ArrowLeft && h_height > MIN_FLY_HEIGHT){
            h_forward_speed = Math.max(h_forward_speed - delta_time * 200,  MAX_SPEED)
        }

        if(h_forward_speed){
            h_forward_speed = Math.min(0, h_forward_speed + delta_time * 60)
            h_angle += h_forward_speed * delta_time
        }

        const h_slope_angle = h_forward_speed/MAX_SPEED * MAX_SLOPE_ANGLE

        // updates the height
        if(pressed_keys.ArrowUp) {
            h_height = Math.min(h_height + delta_time * 20, MAX_HEIGHT)
        }

        if(pressed_keys.ArrowDown) {
            const min_h = (h_slope_angle> 0) ? MIN_FLY_HEIGHT : MIN_HEIGHT 
            h_height = Math.max(h_height - delta_time * 20, min_h)
        }

        // updates the scene nodes
        upper_helices.rotationY = helices_rotation_angle
        tail_helices.rotationZ = helices_rotation_angle
        heli_forward.value = h_angle
        helicopter.rotationZ = h_slope_angle
        heli_height.value = [0, h_height, 0]
        car_sirens.rotationY = time * 600 // TODO: a constant

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

        evolve_scene(delta_time)
        evolve_boxes(delta_time)

        // lookAt(eye, at, up)
        if(Mview.follow) Mview = getFollowMatrix()
        else if(Mview.axono) Mview = getAxonoMatrix()
        else if (Mview.freeCam) Mview = getFreeCamMatrix()

        scene_graph.drawScene(draw, Mview)
    }
}

const urls = ["shader.vert", "shader.frag"];
Promise.all([
    loadShadersFromURLS(urls),
    fetch('scene-graph.json').then(sg => sg.json())
]).then(setup)