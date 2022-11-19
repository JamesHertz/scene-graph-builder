class Node{
    
    constructor(name){
        this.name = name
        this.children = []
        this._translation = []
        this._scale = []
        this._rotationX = undefined
        this._rotationY = undefined
        this._rotationZ = undefined
    }

    /*
    abstract function draw(){

    }
    */
    get scale(){

    }

    set scale(newScale){

    } 

    get translation(){

    }

    set translation(newTranslation){

    }

    get rotationX(){

    }

    set rotationX(newRotation){

    }

    get rotationY(){

    }

    set rotationY(newRotation){

    }

    get rotationZ(){

    }

    set rotationZ(newRotation){

    }

    get modelMatrix(){

    }

}


class LeafNode{
    // fill later
    constructor(){

    }


    // later
    draw(){

    }

}


class NormalNode{

    // fill later
    constructor(){

    }

    addNode(node){

    }

    getNode(name){

    }


    draw(){

    }

}

/*

*/
export default class SceneGraph{
    constructor(filename){
        this.root = null
        this.nodes = null
        // the parser ...

    }

    getNode(name){

    }

    drawScene(){
        // draw scene
    }

} 