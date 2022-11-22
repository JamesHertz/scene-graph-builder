import {rotateX, rotateY, rotateZ, mat4, vec3, mult, translate, scalem} from "../libs/MV.js";

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
        // apply the extra transformations first :)
        let modelMatrix = this.trans.reduce(
            (o, t) => mult(o, t.transMatrix), mat4())

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

        return modelMatrix
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

// think about the rest later
class LeafNode extends Node{
    // fill later
    constructor(name, primitive, color){
        super(name)
        this._primitive = primitive
        this._color = color
    }

    get color(){
        return this._color
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
        draw(this.primitive, mult(tmp, this.modelMatrix), this.color)
    }

}

class RegularNode extends Node{

    // fill later
    constructor(name){
        super(name)
        this.children = []
        this.c_dict = {}
    }

    // adds a new node to this node 
    addNode(node){
        if(node.name in this.c_dict)
            throw new Error("A parent shouldn't two child with the same name")

        if(node.name)
            this.c_dict[node.name] = node

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
    "name",
    "extra-trans",
    "type" // it's required but it's here just to not guarantee not problem will happen
]

// required keys for leaf and regular nodes respectively
const leaf_optionals = [...optional_keys, 'color']
const leaf_keys = ['primitive']
const regular_keys = ['children']

const colors = {
    red: vec3(1, 0, 0),
    yellow: vec3(1, 1, 0),
    blue: vec3(0, 0, 1),
    grey: vec3(0.5, 0.5, 0.5),
    green: vec3(0, 1, 0),
    white: vec3(1, 1, 1),
    black: vec3(0, 0, 0)
}

/**
 * 
 * @param {Object} node 
 * @param {Array<String>} optKeys  optionals keys the object can have
 * @param {Array<String>} reqkeys  required keys the object should have
 */

function createNode(node, optKeys, reqkeys){

    const obj = {}
    const allkeys = [...optKeys, ...reqkeys]

    for(let k in node){
        if(!allkeys.includes(k))
            throw new Error(`Unexpected key '${k}'.`)
        obj[k] = node[k]
    }

    for(let k of reqkeys){
        if(!(k in obj))
            throw new Error(`Missing key '${k}'.`)
    }

    return obj
}


const trans_type1 = {
    'scale': Scale,
    'translation': Translation
}

const trans_type2 = {
    'rotation-x': RotationX,
    'rotation-y': RotationY,
    'rotation-z': RotationZ
}

const DEFAULT_COLOR = colors.white

// TODO: think about the txt ....
// TODO: refactor the Error parsing 'extra-trans' ....
// TODO: functions for each of the types: like validateRotation, validateTransOrScale
// TODO: take out colors as required X
// TODO: unicity test
function parseTrans(trans){
    const {type, value} = createNode(trans, [], ['type', 'value'])
    let builder;

    if(builder = trans_type1[type]){
        if(value instanceof Array 
            && value.length == 3 
            && value .every(e => typeof(e) == 'number')) return new builder(value)

        throw new Error(`Error parsing 'extra-trans': Invalid value for '${type}' type. Expected an array of 3 numbers.`)
    }else if(builder = trans_type2[type]){
        if(typeof(value) != 'number')
            throw new Error(
                `Error parsing 'extra-trans': Invalid value for '${type}' type. Expected a number.`
                )
        return new builder(value)
    }else{
        throw new Error(`Error parsing 'extra-trans': Invalid transformation type:'${type}'`)
    }
}

function fillNodeInfo(node, info){
    let extTrans = info['extra-trans']
    if(extTrans){
        if(!(extTrans instanceof Array))
            throw new Error(`Expected an array as 'extra-trans' but found ${trans.constructor}`)
        for(let t of extTrans)
            node.addTransformation(parseTrans(t))
    }

    for(let k of ['scale', 'translation']){
        let trans = info[k]
        if(trans !== undefined){
            if(trans instanceof Array 
                && trans.length == 3 
                && trans.every(e => typeof(e) == 'number')){
                    node[k] = trans
            }else
                throw Error(
                    `Invalid '${k}'. Expected an array of 3 numbers.`
                )

        }
    }
    for(let [key, attr] of [
        ['rotation-x', 'rotationX'], 
        ['rotation-y', 'rotationY'], 
        ['rotation-z', 'rotationZ'],
    ]){
        let trans = info[key]
        if(trans !== undefined){
            if(typeof(trans) != 'number')
                throw new Error(`Expected number as '${key}' but found '${typeof(trans)}'`)
            node[attr] = trans
        }
    }

    return node
}

function parseName(name){
    if(typeof(name) === 'string' || name == undefined)
        return name || null
    else
        throw new Error(`Invalid node's name: ${name}. Expected a string or nothing.`)
}

function parseLeafNode(info, primitives){
    const node = createNode(info, leaf_optionals, leaf_keys)
    let  {name, primitive, color} = node

    name = parseName(name)

    if(!primitives.includes(primitive))
        throw new Error(`Invalid primitive:'${primitive}'`)

    // Future plans: accept an array of 3 numbers as well
    if(color === undefined) color = DEFAULT_COLOR
    else if(!(color in colors))
        throw new Error(`Invalid color:'${color}'`)

    const leafNode = new LeafNode(name, primitive, color)

    return fillNodeInfo(leafNode, node)

}

function parseRegularNode(parseCtx, info){
    const {base_nodes} = parseCtx

    function parseChild(child){
        if(typeof(child) === 'string'){
            const node = base_nodes[child]
            if(!node) throw new Error(`Node '${child}' doesn't exit.`)
            return node 
        }else if(typeof(child) === 'object'){
            return parseNode(parseCtx, child)
        }else{
            throw new Error('Invalid child. It should be either a <node_name> or a <node>')
        }
    }

    const node = createNode(info, optional_keys, regular_keys)

    let name = parseName(node.name)
    const regularNode = fillNodeInfo(new RegularNode(name), node) 

    const {children} = node

    if (children instanceof Array){

        for(let child of children)
             regularNode.addNode(parseChild(child))
        
    }else {
        regularNode.addNode(parseChild(children))
    }

    return regularNode
}


function parseNode(parseCtx, info){
    if(typeof(info) != 'object') 
        throw new Error(`Expected an object as node but found ${typeof(info)}`)

    const {type} = info
    if(type == LEAF){
        try{
            return parseLeafNode(info, parseCtx.primitives)
        }catch(err){
           throw new Error('Error parsing leaf node: '  + err.message) 
        }
    }else if(type == REGULAR){
        try{
            return parseRegularNode(parseCtx, info)
        }catch(err){
           throw new Error('Error parsing regular node: '  + err.message) 
        }
    }else{
        throw new Error(
            `Invalid node type '${type}'\n It should've been either '${REGULAR}' or '${LEAF}'.`
        )
    }

}

function parseScene(scene_desc, primitives){
    if(typeof(scene_desc) != 'object')
        throw new Error('Invalid scene_desc')
    let scene;

    // missing some type check
    try{
        scene = createNode(scene_desc, ['nodes'], ['root']) 
    }catch(err){
        throw new Error('Error parsing scene desc: ' + err.message)
    }

    // check the scene.node type ....
    const base_nodes = scene['base-nodes']
    const nodes = {}
    if(base_nodes){
        if(typeof(scene.nodes) != 'object')
            throw new Error('Scene nodes should be an dictionary of nodes.')

        for(let key in base_nodes){
            const node_desc = base_nodes[key]
            const {name} = node_desc
            const parseCtx = {primitives, nodes}

            if(name != undefined && name != key)
                throw new Error(`Base nodes shouldn't be named.\nTheir keys are taken as their keys.`)

            node_desc.name = key
            nodes[key] = parseNode(parseCtx, node_desc)
        }
    }

    // check if root is an object
    const root = parseNode({primitives, nodes}, scene.root)

    return {root, nodes}
}

class SceneGraph{

    /**
     * 
     * @param {Object} scene_desc 
     * @param {Array<String>} primitives 
     */
    // think about this...
    constructor(scene_desc, primitives){
        const {root, base_nodes} = parseScene(scene_desc, primitives)
        this._root = root
        this.base_nodes = base_nodes
        this.parseCtx = {base_nodes, primitives}
    }

    get root(){
        return this._root
    }

    // think about this later
    getNode(name){
        return this.nodes.find( n => n.name == name)
    }

    findNode(path){
        // should go depening searching for the node
    }

    createNode(node_desc){
        return parseNode(this.parseCtx, node_desc)
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

const node = {
    type: 'regular',
    translation: [2, 2, 2],
    'extra-trans': [
        {type: 'translation', value: [1, 1, 1]}
    ],
    children: [{
        type: 'leaf',
        primitive: 'cube'
    }, 'floor']
}

const floor = new LeafNode('floor', 'cube', vec3(1, 1, 1))

const parseCtx = {
    primitives: ['cube', 'cylinder'],
    nodes: {floor} 
}

const result = parseNode(parseCtx, node)
console.log(result.modelMatrix)
console.log(result.children)