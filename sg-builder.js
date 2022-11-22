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
        this._children = []
        this.c_dict = {}
    }

    // adds a new node to this node 
    addChild(node){
        if(node.name in this.c_dict)
            throw new Error(`Regular node already has child node named '${node.name}'`)

        if(node.name)
            this.c_dict[node.name] = node

        this._children.push(node)
    }

    // retuns an imediate child with name "name"
    getChild(name){
        if(name in this.c_dict)
            return this.c_dict[name]
        return null
    }

    removeChild(child){
        let ref;

        if(typeof(child) == 'string')
            ref = this.c_dict[child]
        else // assuming it's an object
            ref = this._children.find( c => child == c)
        
        if(ref){
            this._children = this._children.filter(c => c != ref)
            delete this.c_dict[ref.name]
            return ref
        }
        
        return null
    }

    get children(){
        return this._children
    }

    /**
     * 
     * @param {Array} stack 
     * @param {Function} upload 
     */
    draw(stack, draw){
        const lastIdx = stack.length - 1
        stack[lastIdx] = mult(stack[lastIdx], this.modelMatrix)

        for(let child of this._children){
            const aux = stack.pop()
            stack.push(aux, aux)
                child.draw(stack, draw)
            stack.pop()
        }
    }

}


// TODO: have constants for each one of the attributes

// parsing functions

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

function prefixErrorMessage(prefix, error){
    error.message = prefix + error.message
    return error
}
/**
 * 
 * @param {Object} node 
 * @param {Array<String>} optKeys  optionals keys the object can have
 * @param {Array<String>} reqkeys  required keys the object should have
 */

// think about the error code
function createNode(node, optKeys, reqkeys){
    if(typeof(node) != 'object')
        throw new Error(`Expected an object but found '${typeof(node)}'`)

    const obj = {}
    const allkeys = [...optKeys, ...reqkeys]

    for(let k in node){
        if(!allkeys.includes(k))
            throw new Error(`Unexpected key '${k}'.`)
        obj[k] = node[k]
    }

    for(let k of reqkeys){
        if(!(k in obj))
            throw new Error(`Key '${k}' is missing.`)
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

function getTransOrScale(type, trans){
    if(trans instanceof Array 
            && trans.length == 3 
            && trans.every(e => typeof(e) == 'number')) return trans
    throw new Error(`Invalid value for ${type}. Expected an array of 3 numbers.`)
}

function getRotation(key, value){
    if(typeof(value) != 'number')
         throw new Error(
                ` Invalid value for '${key}' type. Expected a number.`
                )
    return value
}


function parseColor(color){
    if(color === undefined) return DEFAULT_COLOR
    else if(color in colors) return colors[color]
    else if(color instanceof Array 
            && color.length == 3 
            && color.every(e => typeof(e) == 'number')){
                return color
    }else
        throw new Error(`Invalid color:'${color}'`)
}



// TODO: think about the txt ??
// TODO: refactor the Error parsing 'extra-trans' X
function parseTrans(trans){
    const {type, value} = createNode(trans, [], ['type', 'value'])
    let builder;

    if(builder = trans_type1[type])
        return new builder(getTransOrScale(type, value))
    else if(builder = trans_type2[type])
        return new builder(getRotation(type, value))
    else{
        throw new Error(`Invalid transformation type:'${type}'`)
    }
}

function fillNodeInfo(node, info){

    try{

        let extTrans = info['extra-trans']
        if(extTrans !== undefined){
            if(extTrans instanceof Array){
                for(let t of extTrans)
                    node.addTransformation(parseTrans(t))
            }else if(typeof(extTrans) == 'object'){
                    node.addTransformation(parseTrans(extTrans))
            }else
                throw new Error(
                    `Expected an array or an trans_object as 'extra-trans' but found ${typeof(extTrans)}`
                    )
        }

    }catch(err){
        throw prefixErrorMessage("Error parsing 'extra-trans': ", err)
    }
 
    for(let k of ['scale', 'translation']){
        let trans = info[k]
        if(trans !== undefined)
            node[k] = getTransOrScale(k, trans)
        
    }
    for(let [key, attr] of [
        ['rotation-x', 'rotationX'], 
        ['rotation-y', 'rotationY'], 
        ['rotation-z', 'rotationZ'],
    ]){
        let trans = info[key]
        if(trans !== undefined)
            node[attr] = getRotation(key, trans)
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
    color = parseColor(color)
    const leafNode = new LeafNode(name, primitive, color)

    return fillNodeInfo(leafNode, node)

}

function parseRegularNode(parseCtx, info){

    function parseChild(child){
        try{
            return parseNode(parseCtx, child)
        }catch(err){
            throw prefixErrorMessage('Error parsing children: ', err)
        }
    }

    const node = createNode(info, optional_keys, regular_keys)

    let name = parseName(node.name)
    const regularNode = fillNodeInfo(new RegularNode(name), node) 

    const {children} = node

    if (children instanceof Array){

        for(let child of children)
             regularNode.addChild(parseChild(child))
        
    }else {
        regularNode.addChild(parseChild(children))
    }

    return regularNode
}

function checkOrderProblem(parseCtx, info){
    const {base_nodes, nodes} = parseCtx
    let node = null
    if(nodes && base_nodes[info] !== null && (node = nodes[info])){
        if(!node.name) node.name = info // if node doesn't have a name
        base_nodes[info] = null 
        base_nodes[info] = parseNode(parseCtx, node)
    }
    return node
}

function parseNode(parseCtx, info){
    const {base_nodes, primitives} = parseCtx

    if(typeof(info) === 'string'){
        const node = base_nodes[info] || checkOrderProblem(parseCtx, info)
        if(!node) throw new Error(`Base node '${info}' doesn't exit.`)
        return node
    }else if(typeof(info) !== 'object')
        throw new Error(`Expected a object or a base-node name but found '${typeof(info)}'`)

    const {type} = info
    if(type == LEAF){
        try{
            return parseLeafNode(info, primitives)
        }catch(err){
           throw prefixErrorMessage('Error parsing leaf node: ', err) 
        }
    }else if(type == REGULAR){
        try{
            return parseRegularNode(parseCtx, info)
        }catch(err){
           throw prefixErrorMessage('Error parsing regular node: ', err) 
        }
    }else{
        // think for a better solution :)
        const txt = JSON.stringify(info)
        throw new Error(
            `Invalid node type in '${txt}'\n It should've been either '${REGULAR}' or '${LEAF}'.`
        )
    }

}

function parseScene(scene_desc, primitives){
    let scene;

    try{
        scene = createNode(scene_desc, ['base-nodes'], ['root']) 
    }catch(err){
        throw prefixErrorMessage('Error parsing scene_desc: ', err)
    }

    const nodes = scene['base-nodes']
    const base_nodes = {}

    // idea to solve the problem of order
    // in parseNode() sends nodes are one of the args
    const parseCtx = {primitives, base_nodes, nodes}
    if(nodes){
        if(typeof(nodes) != 'object')
            throw new Error('Invalid base-nodes. It should be a dictionary of nodes.')

        for(let key in nodes){
            const node_desc = nodes[key]
            const {name} = node_desc

            if(name != undefined && name != key)
                throw new Error(
                    `Base node name inconsistence. It's named as '${name}' while it's key is '${key}'`
                    )

                if(!base_nodes[key]){
                    node_desc.name = key
                    base_nodes[key] = parseNode(parseCtx, node_desc)
                }

        }
    }

    try{
        const root = parseNode(parseCtx, scene.root)
        return {root, base_nodes}
    }catch(err){
        throw prefixErrorMessage('Error parsing root: ', err)
    }
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
    getBaseNode(name){
        return this.base_nodes[name]
    }

    findNode(path){
        // should go depening searching for the node
    }

    createNode(node_desc){
        //if(typeof(node_desc) == 'string')
        //    node_desc = {type:'regular', children: node_desc}
        return parseNode(this.parseCtx, node_desc)
    }

    /**
     * 
     * @param {(primitive, modelView, color) => void} draw 
     * @param {mat4} Mview 
     */
    drawScene(draw, Mview){
        const stack = [Mview] 
        this.root.draw(stack, draw)
    }

} 

export {
    SceneGraph
}

/*
const node = {
    type: 'regular',
    translation: [2, 2, 2],
    'extra-trans': [
        {type: 'translation', value: [1, 1, 2]}
    ],
    children:  [{
        type: 'leaf',
        primitive: 'cube'
    }, 'floor']
}

const floor = new LeafNode('floor', 'cube', vec3(1, 1, 1))

const parseCtx = {
    primitives: ['cube', 'cylinder'],
    base_nodes: {floor} 
}

const result = parseNode(parseCtx, node)
console.log(result.modelMatrix)
console.log(result.children)
const sg_desc = {
    root: {
        type: 'regular',
        children: 'box'
    },
    'base-nodes': {
        box: {
            type: 'regular',
            scale: [2, 2, 2],
            children: ['large-box']
        },
        
        'large-box': {
            type: 'leaf',
            primitive: 'cube'
        }

    }
}
const sg = new SceneGraph(sg_desc, ['cube'])
*/

