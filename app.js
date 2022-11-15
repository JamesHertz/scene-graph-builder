import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten , scalem} from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js'
import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as TORUS from '../../libs/objects/torus.js'
import { mat4 } from "../libs/MV.js";
import { multRotationZ, multTranslation, popMatrix, pushMatrix } from "../libs/stack.js";

//import * as PYRAMID from '../../libs/objects/pyramid.js'

let Mview = lookAt([100, 100, 100], [0, 0, 0], [0,1,0])

/** @type WebGLRenderingContext */
let gl;

let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
//let animation = true;   // Animation is running


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

    function uploadColor(color){
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), color)
    }

    function helice(){
        //multTranslation([-2, 1.75, 0])
        multScale([4, 0.4, 0.4])
        uploadModelView()
        SPHERE.draw(gl, program, mode)
    }

    function body(){
        multScale([5, 3, 3])
        uploadModelView()
        SPHERE.draw(gl, program, mode)
    }

    function back(){
        // T R S
        multTranslation([0, 1.75, 0])
        multScale([0.3, 0.6, 0.3])
        uploadModelView()
        CYLINDER.draw(gl, program, mode)
    }
    function upper_helices(){
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

    function drawSchene(){
        pushMatrix()
            body()
        popMatrix()
        pushMatrix()
            back()
        popMatrix()
            upper_helices()
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
        drawSchene()
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))