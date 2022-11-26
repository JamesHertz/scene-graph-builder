/**
 * @author James Hertz
 * @author Iago Paulo
 * 
 * This library was done in order to facilitate the process of specifying
 * the SceneGraph and manipulate it's node.
 * 
 * The main take away is: it takes a JSON in the constructor of the class 
 * SceneGraph and it parses it according to a convesion defined (it's exaustive
 * in it's error to be helpful and for future by other people), there are two kings 
 * of nodes the LeafNode and the Regular node, each one of them has a set of 
 * transformation that can be applied to. The main difference is that the 
 * LeafNode represents the Leafs of our graph so it has two extra attributes
 * that are the primitive (one of the ones passed in the SceneGraph construtor)
 * and a color. On the other hand the Regular nodes that represents non-leaf Nodes
 * has an extra attribute that is it's children (can be both Regular nodes or Leaf nodes). 
 *
 * As stated above there are transformation that can be applied to the nodes using the method 
 * addTransformation or by change one of it's attributes (rotationX, translation, etc...)
 */

import {rotateX, rotateY, rotateZ, mat4, vec3, mult, translate, scalem} from "../libs/MV.js";

// represents a transformation
class BaseTransformation{
    /**
     * 
     * @param { number | Array<number>  } value tranformation value, it can be a number 
     *  in case of a rotation or an array of numbers if it's a translation or an scale
     * @param { Node } parentNode the parent node that this transformation is part of
     */
    constructor(value, parentNode){ 
        this._parent = parentNode
        this.value = value 
    }

    get value(){
        return this._value
    }

    set value(newValue){
        this._value = newValue
        this.dirty = true // means the value of the transformation was changed

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

// Represents an node, it can be thought of as an abstract node
class Node{
    
    constructor(name){
        this._name = name
        this.dirty = true // means a change was made so the modelMatrix needs to be recalculated
        this.trans = [] // adicionals transformations that can be added to the node
    }
    
    changeHandler(){
        this.dirty = true
    }

    // calculates the node "transformation" matrix
    // by applying the ones that correspondes to it's
    // attributes first (in the order TRS) and the extra
    // ones by the order they appeared/are added
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
        return trans
    }

    removeTransformation(trans){
        this.trans = this.trans.filter( t => t != trans)
        trans.parent = null
    }

    // calculates the model matrix lazily :)
    // I called it model but it's more like a matrix with the 
    // transformation made to the object itself. To get the real
    // model matrix we would have take in account all it's predecessors
    get modelMatrix(){
        if(this.dirty){
            this._modelMatrix = this.calc_model_matrix()
            this.dirty = false
        }

        return this._modelMatrix
    }

}

class LeafNode extends Node{
    /**
     * 
     * @param {string | null} name 
     * @param {string} primitive 
     * @param {Array<number>} color 
     */
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

    /**
     * Draws the leaf node by calling the given function 
     * draw which will recieve the node primitive, it's modelView
     * and it's color (an array of 3 numbers)
     * @param {Array} stack 
     * @param {(primitive, modelView, color) => void} draw 
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
        return node
    }

    // retuns an imediate child with name "name"
    getChild(name){
        return this.c_dict[name]
    }

    // given a node names 
    // it searches for it in it's direct nodes
    // if no such one exist it tried on the ones that
    // belongs to it's child that doesn't have names
    searchNode(name){
        let child;
        if(child = this.getChild(name)) return child

        for(child of this.children){
            if(!child.name && child instanceof RegularNode){
                const node = child.getChild(name)
                if(node) return node
            }
        }
        return null
    }

    /**
     * 
     * @param {Node | string} child  the name of the node or it's reference
     * @returns a Node or null if such node doesn't exit 
     */
    removeChild(child){
        let ref;

        if(typeof(child) == 'string')
            ref = this.c_dict[child]
        else // assuming it's a Node
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
     * calls the draw on each of it's children, it keeps the modelMatrix
     * on the top of the stack and push and pops it after a call to one
     * of it's child 
     * @param {Array} stack 
     * @param {(primitive, modelView, color) => void} draw 
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

// node's keys
const optional_keys= [
    "rotation-x",
    "rotation-y",
    "rotation-z",
    "translation",
    "scale",
    "name",
    "extra-trans",
]

// required keys for leaf and regular nodes respectively
const leaf_optionals = [...optional_keys, 'color']
const leaf_keys = ['primitive']
const regular_keys = ['children']

// some supported colors name
const colors = {
    red: vec3(1, 0, 0),
    yellow: vec3(1, 1, 0),
    blue: vec3(0, 0, 1),
    grey: vec3(0.5, 0.5, 0.5),
    green: vec3(0, 1, 0),
    brown: vec3(0.82, 0.71, 0.55),
    black: vec3(0, 0, 0),
    white: vec3(1, 1, 1),
    'dark-green': vec3(0, 0.5, 0),
    'light-grey': vec3(0.65, 0.65, 0.65),
    'dark-brown': vec3(0.26, 0.15, 0),
}

const DEFAULT_COLOR = colors.white

function prefixErrorMessage(prefix, error){
    error.message = prefix + error.message
    return error
}

/**
 * Given an object it checks if the received object has
 * all the required keys (reqKeys) and has nothing more than
 * the required keys plus the optional keys (optKeys).
 * 
 * If so it returns another object with all the keys the recieved object
 * had. Else it throws an exception.
 * 
 * @param {object} node 
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

// checks if the given object for a translation or a scale
// is an Array of 3 numbers, if it isn't it throws an error
function getTransOrScale(type, trans){
    if(trans instanceof Array 
            && trans.length == 3 
            && trans.every(e => typeof(e) == 'number')) return trans
    throw new Error(`Invalid value for ${type}. Expected an array of 3 numbers.`)
}

// checks if the value given as an rotation
// is a number, if it isn't it throws an error
function getRotation(key, value){
    if(typeof(value) != 'number')
         throw new Error(
                ` Invalid value for '${key}' type. Expected a number.`
                )
    return value
}

// parses the color
// the color can the name of one of the supported ones above
// or an array of 3 (rgb) or 4 (rgba) numbers
function parseColor(color){
    if(color === undefined) return DEFAULT_COLOR
    else if(color in colors) return colors[color]
    else{
        const {length} = color
        if(color instanceof Array 
            && (length == 3 || length == 4) 
            && color.every(e => typeof(e) == 'number')){
                return color
        }else
             throw new Error(`Invalid color:'${color}'`)

    } 
}

// parse an transformation of the 'extra-trans' attribute
// these transformation should be an object of type
// {type, value} where type is one of the transformation 
// (rotation-x, rotation-y, translation, etc..) and the value the 
// transformation correspoding value, for example if it's a rotation is has to be
// and number else if it is an translation or an scale it has to be 
// and array of 3 elements
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

// it fills the nodes remaing informations
// the ones that are common to both regular and leaf node
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

// parses the name that can be none or a string
// without '/' character
function parseName(name){
    if(name == undefined || 
        typeof(name) === 'string' && !name.includes('/'))
        return name || null
    else
        throw new Error(`Invalid node's name: '${name}'. Expected a string without '/' character or nothing.`)
}

// parses a leaf node given the primitives that
// the SceneGraph supports
function parseLeafNode(info, primitives){
    const node = createNode(info, leaf_optionals, leaf_keys)
    let  {name, primitive, color} = node

    name = parseName(name)

    if(!primitives.includes(primitive))
        throw new Error(`Invalid primitive:'${primitive}'`)

    color = parseColor(color)
    const leafNode = new LeafNode(name, primitive, color)

    return fillNodeInfo(leafNode, node)

}

// parses a Regular node where the parseCtx
// are informations about the parsing, it's basically
// an object that has the key primitives, base_nodes and
// nodes (if we are parsing the base_nodes)
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

// when parsing base-nodes we may stumble into a problem
// that is I am parsing this regular node that has as a child
// another base-node that I haven't parse yet. 
// This function tries to parses that node while
// reporting an error if a loop is found
function checkOrderProblem(parseCtx, info){
    const {base_nodes, nodes} = parseCtx
    let node = null
    if(nodes && base_nodes[info] !== null && (node = nodes[info])){
        if(!node.name) node = {...node, name: info} // if node doesn't have a name
        // we set this to null which means we are parsing this node
        // then we check if it's not null meaning we are not parsing it
        // because if while parsing this node we try try to parse it again
        // we have a cycle :)
        base_nodes[info] = null 
        node = base_nodes[info] = parseNode(parseCtx, node)
    }
    return node
}

// uses to parse a node, it decides which kind of node 
// we are dealing with and calls it's respective parser
// The info (information about the node) can be botha json
// or a string. In the ladder case it returns the corresponding base-node
function parseNode(parseCtx, info){
    const {base_nodes, primitives} = parseCtx

    if(typeof(info) === 'string'){
        // check's if the node was parsed before or if it exist but it wasn't parsed
        // this will happen because while parsing the children of a regular node
        // we willl call this function for each one of them 
        const node = base_nodes[info] || checkOrderProblem(parseCtx, info)
        if(!node) throw new Error(`Base node '${info}' doesn't exit.`)
        return node
    }else if(typeof(info) !== 'object')
        throw new Error(`Expected a object or a base-node name but found '${typeof(info)}'`)

    const {primitive, children} = info

    if(primitive && children || !(primitive || children)){
        const txt = JSON.stringify(info)
        throw new Error(
            `Invalid node ${txt}. It should have either key: 'children' and be regular node or 'primitive' and be leaf node`
        )
    // else means primitive || children
    }else if(primitive){
        try{
            return parseLeafNode(info, primitives)
        }catch(err){
           throw prefixErrorMessage('Error parsing leaf node: ', err) 
        }
    }else{ // if(info.children)
        try{
            return parseRegularNode(parseCtx, info)
        }catch(err){
           throw prefixErrorMessage('Error parsing regular node: ', err) 
        }
    }
}

// receives the whole scene and a set of primitives
// that the scene supports and parses it.
// the scene should be a json and include an attribute
// 'root', it can opcionally have another attribute called 'base-nodes'
function parseScene(scene_desc, primitives){
    let scene;

    try{
        // certifing that the scene_desc is an object and that is has
        // 'root' as one of it's key. Also that that it has nothing more
        // than 'root' and 'base-nodes' has keys.
        scene = createNode(scene_desc, ['base-nodes'], ['root']) 
    }catch(err){
        throw prefixErrorMessage('Error parsing scene_desc: ', err)
    }

    const nodes = scene['base-nodes']
    const base_nodes = {} // parsed based nodes that will be Node's object

    // parse context which will store some importants
    // data-structures for parsing.
    const parseCtx = {primitives, base_nodes, nodes}
    if(nodes !== undefined){
        if(typeof(nodes) != 'object')
            throw new Error('Invalid base-nodes. It should be a dictionary of nodes.')

        for(let key in nodes){
            let node_desc = nodes[key]
            const {name} = node_desc

            if(name != undefined && name != key)
                throw new Error(
                    `Base node name inconsistence. It's named as '${name}' while it's key is '${key}'`
                    )
                // check if the base node wasn't parsed, because while parsing base
                // we may stumble into other that weren't parsed yet and we will 
                // parsed then first, which means that we don't need to parse this again
                // To better understand this look for the checkOrderProblem function
                if(!base_nodes[key]){ 
                    node_desc = {...node_desc, name: key}
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
     * @param {Object} scene_desc a json with the description of the scene
     * @param {Array<String>} primitives  an array of strings with the supported primtives
     */
    constructor(scene_desc, primitives){
        const {root, base_nodes} = parseScene(scene_desc, primitives)
        this._root = root
        this.base_nodes = base_nodes
        this.parseCtx = {base_nodes, primitives}
    }

    get root(){
        return this._root
    }

    getBaseNode(name){
        return this.base_nodes[name]
    }

    /**
     * Given a path for a node with the format
     * <node_name_1>/<node_name_2>/.../<target_node_name> it searches
     * follows the path from the root node. It's worth having in mind that 
     * the <node_name_1> is a child's node of the root node.
     * 
     * Also it's worth remembering that it skips the unnamed nodes which 
     * means that if <node_name_n> is within an unamed node that is within 
     * <node_name_n-1>, the following path <node_name_n-1>/<node_name_n>
     * will get us to <node_name_n>.
     * @param {string} path 
     * @returns a node or null if it doesn't find such node
     */
    findNode(path){
        const nodes = path.split('/')
        let curr = this._root
        for(let node of nodes){
            if(!(curr instanceof RegularNode)) return null
            curr = curr.searchNode(node)
        }

        return curr 
    }

    /**
     * Given a json creates a node
     * @param {object} node_desc 
     * @returns 
     */
    createNode(node_desc){
        if(typeof(node_desc) == 'string')
            node_desc = {type:'regular', children: node_desc} // else it would be same as .getBaseNode(node_desc)
        return parseNode(this.parseCtx, node_desc)
    }

    /**
     * Draw's he scene given the ViewMatrix and a draw function.
     * The draw function will receive the LeafNode primitive
     * it's modelViewMatrix and it's color.
     * @param {(primitive, modelView, color) => void} draw 
     * @param {mat4} Mview 
     */
    drawScene(draw, Mview=mat4()){
        const stack = [Mview] 
        this.root.draw(stack, draw)
    }

} 

export {
    SceneGraph,
    RotationX, RotationY, RotationZ, Scale, Translation
}