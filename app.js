import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten , vec3, normalMatrix, rotateX, rotateY, mult} from "../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale} from "../libs/stack.js";

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
    theta: -60,
    gama: 15
}

// TODO: config file with the schene graph
/* 
scene-graph: {
    translation: [tx, ty, tz]
    rotation: [rx, ry, rz]
    scale: [sx, sy, sz]
    ?draw: <node-id> 
    children: []
}

nodes: [
    {
        node-id: id1
        translation: [tx, ty, tz]
        rotation: [rx, ry, rz]
        scale: [sx, sy, sz]
        draw: <node-id> | nodes[]
    }
]
*/

const basic_cameras = {
    front: lookAt([0, 0, 100], [0, 0, 0], [0,1,0]), 
    top: lookAt([0, 100, 0], [0, 0, 0], [0,0,-1]),
    right: lookAt([100, 0, 0], [0, 0, 0], [0,1,0]),
}


const MIN_HEL_HEIGHT = 2.25

let up_speed = 0;
let h_height = MIN_HEL_HEIGHT

/*

the idea is to have something that will always come to zero
but what we can do is to change it.

let up_speed;




*/

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection;

    // set's the mProjection
    resize_canvas()
    //let mProjection = ortho(-10 * aspect, 10 * aspect, -10, 10, 1, 1000)
    let Mview = getAxonoMatrix()

    mode = gl.TRIANGLES

    for(let fig of [SPHERE, CUBE, CYLINDER, TORUS]) fig.init(gl)

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    // dat gui stuffs
    const gui = new dat.GUI({name: 'parameters'})
    const folder = gui.addFolder('axonometric parameters')
    folder.add(axono_pars, 'gama', -90, 90)
    folder.add(axono_pars, 'theta', -90, 90)
    gui.open()
    folder.open()

    // this is to prevent the camera to change when
    // you are typing the angle on the dat.gui input box.
    gui.domElement.addEventListener('keydown', e => e.stopPropagation())

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
                break

            case 'w':
                mode = gl.LINES
                break

            case 's':
                mode = gl.TRIANGLES
                break

            case 'ArrowUp':
                up_speed = Math.min(up_speed + 0.15, .25)
                break
                 
            case 'ArrowDown':
                up_speed = Math.max(up_speed - 0.15, -.25)
                break
        }
    })



    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;
        mProjection = ortho(-25 * aspect, 25 * aspect, -25, 25, 1, 200)
       // mProjection = ortho(-200 * aspect, 200 * aspect, -200, 200, 1, 200)
        gl.viewport(0,0,canvas.width, canvas.height);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function draw(primitive, color=colors.red){
        uploadModelView()
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)

        const mNormal = normalMatrix(modelView(), true)
        gl.uniformMatrix3fv(gl.getUniformLocation(program, "mNormal"), false, flatten(mNormal));
        primitive.draw(gl, program, mode)
    }

    function tiny_helice(){
        //multTranslation([-2, 1.75, 0])
        multScale([1, 0.3, 0.15])
        draw(SPHERE, colors.blue)
    }

    function helice(){
        //multTranslation([-2, 1.75, 0])
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
        // translation: -4, 0.7, 0
        pushMatrix()
            front_tail()
        popMatrix()
        pushMatrix()
            multTranslation([-2.2, 0.3, 0])
            back_tail()
        popMatrix()
        
    }

    // rename this later
    function aux(){
        multScale([0.2, 1, 0.2])
        draw(CUBE, colors.grey)
    }

    function single_bear_paw(){
        pushMatrix()  
            multRotationZ(15)
            multTranslation([1, 0, 0])
            aux()
        popMatrix()
        pushMatrix()  
            multRotationZ(-15)
            multTranslation([-1, 0, 0])
            aux()
        popMatrix()
            multTranslation([0, -0.25, 0])
            multRotationY(90)
            multRotationX(90)
            multScale([0.3, 4, 0.3])
            draw(CYLINDER, colors.yellow)
        
    }

    function bearpaws(){
        pushMatrix()
        //-1 -1.6 -0.77
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
            multTranslation([-6.25, 1.1, 0.1])
            multRotationZ( 2.5 * time * 2 * Math.PI)
            tail_helices()  //Helices pequenas agarradas ao cilindro
        popMatrix()

        pushMatrix()
            multTranslation([0, 1.75, 0])
            multRotationY( 2.5 * time * 2 * Math.PI)
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
            multTranslation([0, h_height, 0])
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

        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        // pretty good idea but you gonna clean up this thing a bit..
        if(up_speed){
            let next_speed = up_speed  - up_speed * 0.01
            up_speed = (Math.abs(up_speed) < 0.1) ? 0 : next_speed;
        }


        //h_height = Math.min( h_height + up_speed, 8)
        if(up_speed < 0)
            h_height = Math.max(h_height + up_speed, MIN_HEL_HEIGHT)
        else
            h_height = Math.min(h_height + up_speed, 20)

        // lookAt(eye, at, up)
        // if it is an axono matrix just recalculate it :)
        if(Mview.axono) Mview = getAxonoMatrix()
        loadMatrix(Mview)
        drawScene()
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))