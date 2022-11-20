import {rotateX, rotateY, rotateZ, mat4, mult, translate, scalem} from "../libs/MV.js";

// transformations...
// abstract base transformation
class BaseTransformation{
    // think about the parent node ...
    constructor(value, parentNode){ 
        this._parent = parentNode
        this.value = value 
    }

    get value(){
        return this._value
    }

    set value(newValue){
        this._value = newValue
        this.dirty = true

        // if the parent is set then :)
        if(this._parent) this._parent.changeHandler()
    }

    get parent(){
        return this._parent
    }

    set parent(newParent){
        this._parent = newParent

        // think about this ...
        if(this.dirty) this._parent.changeHandler()
    }

    get transMatrix(){
        if(this.dirty){
            this.dirty = false
            this._transMatrix = this.calc_trans_matrix()
        }
        return this._transMatrix
    }
}

class Translation extends BaseTransformation{
    constructor(value, parentNode){
        super(value, parentNode)
    }

    calc_trans_matrix(){
        return translate(...this.value)
    }

} 

class Scale extends BaseTransformation{
    constructor(value, parentNode){
        super(value, parentNode)
    }

    calc_trans_matrix(){
        return scalem(...this.value)
    }

}

class RotationX extends BaseTransformation{
    constructor(value, parentNode){
        super(value, parentNode)
    }

    calc_trans_matrix(){
        return rotateX(this.value)
    }
}

class RotationY extends BaseTransformation{
    constructor(value, parentNode){
        super(value, parentNode)
    }

    calc_trans_matrix(){
        return rotateY(this.value)
    }
}

class RotationZ extends BaseTransformation{
    constructor(value, parentNode){
        super(value, parentNode)
    }

    calc_trans_matrix(){
        return rotateZ(this.value)
    }
}

// think about the calc_model_matrix
class Node{
    
    constructor(name){
        this._name = name
        this.dirty = true // means a change was made so the modelMatrix needs to be recalculated
        this.trans = [] // adicionals transformations that can be added to the node
    }
    
    changeHandler(){
        this.dirty = true
    }

    calc_model_matrix(){
        let modelMatrix = mat4()

        for(let k of [
            '_translation',
            '_rotationZ',
            '_rotationY',
            '_rotationX',
            '_scale'
        ]){
            const trans = this[k]
            if(trans)
                modelMatrix = mult(modelMatrix, trans.transMatrix)
        }

        // lastly apply all the remaing transformations ...
        return this.trans.reduce((o, t) => mult(o, t.transMatrix), modelMatrix)
    }
  
    get name(){
        return this._name
    }

    get scale(){
        return this._scale.value
    }

    set scale(newScale){
        this._scale = new Scale(newScale, this)
    } 

    get translation(){
        return this._translation.value
    }

    set translation(newTranslation){
        this._translation = new Translation(newTranslation, this)
    }

    get rotationX(){
        return this._rotationX.value
    }

    set rotationX(newRotationX){
        this._rotationX = new RotationX(newRotationX, this)
    }

    get rotationY(){
        return this._rotationY.value
    }

    set rotationY(newRotationY){
        this._rotationY = new RotationY(newRotationY, this)
    }

    get rotationZ(){
        return this._rotationZ.value
    }

    set rotationZ(newRotationZ){
        this._rotationZ = new RotationZ(newRotationZ, this)
    }

    addTransformation(trans){
        trans.parent = this
        this.trans.push(trans)
    }

    removeTransformation(trans){
        this.trans = this.trans.filter( t => t != trans)
        trans.parent = null
    }

    // calculates the model matrix lazily :)
    get modelMatrix(){
        if(this.dirty){
            this._modelMatrix = this.calc_model_matrix()
            this.dirty = false
        }

        return this._modelMatrix
    }

}


class LeafNode extends Node{
    // fill later
    constructor(name, primitive){
        super(name)
        this._primitive = primitive
    }


    get primitive(){
        return this._primitive
    }

    // later
    /**
     * 
     * @param {Array} stack 
     * @param {Function} upload 
     */
    draw(stack, draw){
        const tmp = stack[stack.length - 1]
        draw(this._primitive, mult(tmp, this.modelMatrix))
    }

}


class NormalNode extends Node{

    // fill later
    constructor(name){
        super(name)
        this.children = []
        this.c_dict = {}
    }

    // adds a new node to this node 
    addNode(node){
        if(node.name)
            this.c_dict[this.name] = node
        this.children.push(node)
    }

    // TODO: think if this thing does actually make sense
    // retuns an imediate child with name "name"
    getNode(name){
        if(name in this.c_dict)
            return this.c_dict[name]
        return null
    }

    /**
     * 
     * @param {Array} stack 
     * @param {Function} upload 
     */
    draw(stack, draw){
        const lastIdx = stack.length - 1
        stack[lastIdx] = mult(stack[lastIdx], this.modelMatrix)

        for(let child of this.children){
            const aux = stack.pop()
            stack.push(aux, aux)
                child.draw(stack, draw)
            stack.pop()
        }
    }

}


// node type
const LEAF = 'leaf', REGULAR = 'regular'

// node's keys
const optional_keys= [
    "rotation-x",
    "rotation-y",
    "rotation-z",
    "translation",
    "scale",
    "name"
]

// required keys for leaf and regular nodes respectively
const leaf_keys = ['primitive', 'color']
const regular_keys = ['children']

/**
 * 
 * @param {Object} node 
 * @param {Array<String>} optKeys  optionals keys the object can have
 * @param {Array<String>} reqkeys  required keys the object should have
 */

function createNode(node, optKeys, reqkeys){

    // think of a better way to reporting the errors ..
    let txt = JSON.stringify(node)

    const obj = {}
    const allkeys = [...optKeys, ...reqkeys]

    for(let k in node){
        if(!allkeys.includes(k))
            throw new Error(`Unexpected key '${k}' in node ${txt}`)
        obj[k] = node[k]
    }

    for(let k of reqkeys){
        if(!(k in obj))
            throw new Error(`Key '${k}' not found in ${txt}`)
    }

    return obj
}

function parseNode(node, primitives){
    const type = node.type
    if(type == LEAF){
        // TODO: check for valid primitive here
        return createNode(node, [optional_keys, leaf_keys])
    }else if(type == REGULAR){
        const node = createNode(node, [optional_keys, regular_keys])
        // TODO: solve the problem with the children
    }else{
        let txt = JSON.stringify(node)
        throw new Error(
            `Unexpected node type in ${txt}\nNode type should be either '${REGULAR}' or '${LEAF}'.`
        )
    }

}

function parseScene(scene_desc){
    if(typeof(scene_desc) != 'object')
        throw new Error('Invalid scene_desc')

    let scene = createNode(scene_desc, ['nodes'], ['root']) 

    if(scene.nodes){
        // do something fun :)
    }

    scene.root = parseNode(scene.root)
    return scene
}

class SceneGraph{

    /**
     * 
     * @param {Object} scene_desc 
     * @param {Array<String>} primitives 
     */
    // think about this...
    constructor(scene_desc, primitives){
        const {root, nodes} = parseScene(scene_desc)
        this.root = root
        this.nodes = nodes
    }

    // think about this later
    getNode(name){
        return this.root.getNode(name)
    }

    drawScene(draw, Mview){
        const stack = [Mview] 
        this.root.draw(stack, draw)
    }

} 


export {
    SceneGraph,
    Node
}



const node = new Node('james')

node.addTransformation(new Translation([1, 1, 1]))
console.log(node.modelMatrix)