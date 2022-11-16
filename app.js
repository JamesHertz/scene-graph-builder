import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten , scalem} from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js'
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as TORUS from '../../libs/objects/torus.js'
import { mat4, rotateX, scale, translate, vec3 } from "../libs/MV.js";
import { multRotationX, multRotationZ, multTranslation, popMatrix, pushMatrix } from "../libs/stack.js";

//import * as PYRAMID from '../../libs/objects/pyramid.js'

let Mview = lookAt([100, 100, 100], [0, 0, 0], [0,1,0])

/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
//let animation = true;   // Animation is running

const colors = {
    red: vec3(1, 0, 0),
    yellow: vec3(1, 1, 0),
    blue: vec3(0, 0, 1),
    grey: vec3(0.5, 0.5, 0.5),
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

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-10 * aspect, 10 * aspect, -10, 10, 1, 100)

    mode = gl.TRIANGLES//gl.LINES; 

    for(let fig of [SPHERE, CUBE, CYLINDER, TORUS]) fig.init(gl)

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    window.addEventListener('keydown', e => {
        switch(e.key){
            case '1':
                Mview = lookAt([100, 100, 100], [0, 0, 0], [0,1,0])
                break
            case '2':
                Mview = lookAt([0, 100, 0], [0, 0, 0], [1,0,0])
                break
            case '3':
                Mview = lookAt([-100, 100, -100], [0, 0, 0], [0,1,0])
                break
            case '4':
                Mview = lookAt([0, 0, 100], [0, 0, 0], [0,1,0])
                break
            case '5':
                Mview = lookAt([0, 0, -100], [0, 0, 0], [0,1,0])
        }
        console.log('It was clicked')
    })



    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;
        mProjection = ortho(-10 * aspect, 10 * aspect, -10, 10, 1, 200)
        gl.viewport(0,0,canvas.width, canvas.height);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function draw(primitive, color=colors.red){
        uploadModelView()
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)
        primitive.draw(gl, program, mode)
    }

    function helice(){
        //multTranslation([-2, 1.75, 0])
        multScale([4, 0.4, 0.4])
        draw(SPHERE, colors.blue)
    }
    
    function helice_junction(){
        multScale([0.3, 0.6, 0.3])
        draw(CYLINDER, colors.yellow)
    }

    function body(){
        multScale([5, 3, 3])
        draw(SPHERE)
    }

    function upper_helices(){
        pushMatrix()  
            multTranslation([0, 1.75, 0])
            helice_junction()
        popMatrix()
        pushMatrix()  
            multTranslation([-2, 1.75, 0])
            helice()
        popMatrix()
        pushMatrix()  
            multTranslation([1, 1.75, 1.75])
            multRotationY(120)
            helice()
        popMatrix()
            multTranslation([1, 1.75, -1.75])
            multRotationY(240)
            helice()
    }
    
    function front_tail(){
        multScale([5, 0.8, 0.35])
        draw(SPHERE)
    }

    function tail_helices(){
        multRotationX(90)
        multScale([0.2, 0.1, 0.2])
        draw(CYLINDER, colors.yellow)
    }

    function back_tail(){
        pushMatrix()
        // think about this :)
            multRotationZ(15)
            multScale([0.6, 1, 0.2])
            draw(SPHERE)
        popMatrix()
        // look at this later
            translate([-0.05, 0.2, 0.1])
            tail_helices()
    }

    function tail(){
        // translation: -4, 0.7, 0
        pushMatrix()
            front_tail()
        popMatrix()
            multTranslation([-2.2, 0.3, 0])
            back_tail()

    }

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

    function drawScene(){
        pushMatrix()
            body()
        popMatrix()
        pushMatrix()
          multTranslation([-4, 0.7, 0])
          tail()
        popMatrix()
        pushMatrix()
            upper_helices()
        popMatrix()
            multTranslation([0, -2, 0])
            bearpaws()
    }

    function render()
    {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        // eye, at, up
        //loadMatrix(lookAt([100, 100, 100], [0, 0, 0], [0,1,0]));
        loadMatrix(Mview)
        drawScene()
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))