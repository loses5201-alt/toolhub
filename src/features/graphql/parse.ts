/*
  GraphQL 語法分析 —— 純函式、無 DOM。把 token 串遞迴下降成 AST。
  支援 executable(query/mutation/subscription/fragment)與 SDL
  (type/interface/enum/input/union/scalar/schema/directive)。
*/
import { lex, type Tok } from './lex'

// AST 以鬆散物件表示,kind 區分種類。
export type Node = Record<string, unknown> & { kind: string }

class Parser {
  i = 0
  constructor(public toks: Tok[]) {}
  peek() {
    return this.toks[this.i]
  }
  next() {
    return this.toks[this.i++]
  }
  is(value: string) {
    const t = this.peek()
    return (t.kind === 'punct' || t.kind === 'name') && t.value === value
  }
  expect(value: string) {
    if (!this.is(value)) throw new Error(`預期「${value}」,卻得到「${this.peek().value || 'EOF'}」`)
    return this.next()
  }
  name(): string {
    const t = this.peek()
    if (t.kind !== 'name') throw new Error(`預期名稱,卻得到「${t.value || 'EOF'}」`)
    return this.next().value
  }

  parseDocument(): Node {
    const defs: Node[] = []
    while (this.peek().kind !== 'eof') defs.push(this.parseDefinition())
    if (!defs.length) throw new Error('文件是空的')
    return { kind: 'Document', definitions: defs }
  }

  parseDefinition(): Node {
    let desc: string | undefined
    if (this.peek().kind === 'string') desc = this.next().value
    if (this.is('{')) return this.parseOperation(undefined)
    const k = this.peek()
    if (k.kind === 'name') {
      switch (k.value) {
        case 'query':
        case 'mutation':
        case 'subscription':
          return this.parseOperation(this.next().value)
        case 'fragment':
          return this.parseFragmentDef()
        case 'schema':
        case 'scalar':
        case 'type':
        case 'interface':
        case 'union':
        case 'enum':
        case 'input':
        case 'directive':
          return this.parseTypeSystem(desc)
      }
    }
    throw new Error(`無法解析的定義:「${k.value || 'EOF'}」`)
  }

  parseOperation(op?: string): Node {
    let name: string | undefined
    let vars: Node[] = []
    let directives: Node[] = []
    if (op) {
      if (this.peek().kind === 'name') name = this.name()
      if (this.is('(')) vars = this.parseVariableDefs()
      directives = this.parseDirectives()
    }
    const selectionSet = this.parseSelectionSet()
    return { kind: 'Operation', operation: op || 'query', name, vars, directives, selectionSet, shorthand: !op }
  }

  parseVariableDefs(): Node[] {
    this.expect('(')
    const out: Node[] = []
    while (!this.is(')')) {
      this.expect('$')
      const varName = this.name()
      this.expect(':')
      const type = this.parseType()
      let def: Node | undefined
      if (this.is('=')) {
        this.next()
        def = this.parseValue()
      }
      out.push({ kind: 'VarDef', name: varName, type, default: def, directives: this.parseDirectives() })
    }
    this.expect(')')
    return out
  }

  parseType(): Node {
    let t: Node
    if (this.is('[')) {
      this.next()
      const inner = this.parseType()
      this.expect(']')
      t = { kind: 'ListType', type: inner }
    } else {
      t = { kind: 'NamedType', name: this.name() }
    }
    if (this.is('!')) {
      this.next()
      t = { kind: 'NonNull', type: t }
    }
    return t
  }

  parseSelectionSet(): Node {
    this.expect('{')
    const sels: Node[] = []
    while (!this.is('}')) sels.push(this.parseSelection())
    this.expect('}')
    if (!sels.length) throw new Error('選擇集合不可為空 {}')
    return { kind: 'SelectionSet', selections: sels }
  }

  parseSelection(): Node {
    if (this.is('...')) {
      this.next()
      if (this.peek().kind === 'name' && this.peek().value === 'on') {
        this.next()
        const typeName = this.name()
        return { kind: 'InlineFragment', typeCondition: typeName, directives: this.parseDirectives(), selectionSet: this.parseSelectionSet() }
      }
      if (this.is('{')) {
        return { kind: 'InlineFragment', typeCondition: undefined, directives: [], selectionSet: this.parseSelectionSet() }
      }
      const fname = this.name()
      return { kind: 'FragmentSpread', name: fname, directives: this.parseDirectives() }
    }
    let alias: string | undefined
    let fieldName = this.name()
    if (this.is(':')) {
      this.next()
      alias = fieldName
      fieldName = this.name()
    }
    const args = this.is('(') ? this.parseArguments() : []
    const directives = this.parseDirectives()
    const selectionSet = this.is('{') ? this.parseSelectionSet() : undefined
    return { kind: 'Field', alias, name: fieldName, args, directives, selectionSet }
  }

  parseArguments(): Node[] {
    this.expect('(')
    const out: Node[] = []
    while (!this.is(')')) {
      const argName = this.name()
      this.expect(':')
      out.push({ kind: 'Argument', name: argName, value: this.parseValue() })
    }
    this.expect(')')
    return out
  }

  parseDirectives(): Node[] {
    const out: Node[] = []
    while (this.is('@')) {
      this.next()
      const dName = this.name()
      const args = this.is('(') ? this.parseArguments() : []
      out.push({ kind: 'Directive', name: dName, args })
    }
    return out
  }

  parseValue(): Node {
    const t = this.peek()
    if (t.kind === 'int') return { kind: 'Int', value: this.next().value }
    if (t.kind === 'float') return { kind: 'Float', value: this.next().value }
    if (t.kind === 'string') return { kind: 'String', value: this.next().value }
    if (this.is('$')) {
      this.next()
      return { kind: 'Variable', name: this.name() }
    }
    if (this.is('[')) {
      this.next()
      const items: Node[] = []
      while (!this.is(']')) items.push(this.parseValue())
      this.expect(']')
      return { kind: 'ListValue', items }
    }
    if (this.is('{')) {
      this.next()
      const fields: Node[] = []
      while (!this.is('}')) {
        const fName = this.name()
        this.expect(':')
        fields.push({ kind: 'ObjectField', name: fName, value: this.parseValue() })
      }
      this.expect('}')
      return { kind: 'ObjectValue', fields }
    }
    if (t.kind === 'name') {
      const v = this.next().value
      if (v === 'true' || v === 'false') return { kind: 'Boolean', value: v }
      if (v === 'null') return { kind: 'Null' }
      return { kind: 'Enum', value: v }
    }
    throw new Error(`無法解析的值:「${t.value || 'EOF'}」`)
  }

  parseFragmentDef(): Node {
    this.expect('fragment')
    const name = this.name()
    this.expect('on')
    const typeName = this.name()
    return { kind: 'FragmentDef', name, typeCondition: typeName, directives: this.parseDirectives(), selectionSet: this.parseSelectionSet() }
  }

  // --- SDL ---
  parseTypeSystem(desc?: string): Node {
    const kw = this.name()
    if (kw === 'scalar') return { kind: 'ScalarDef', desc, name: this.name(), directives: this.parseDirectives() }
    if (kw === 'union') return this.parseUnion(desc)
    if (kw === 'enum') return this.parseEnum(desc)
    if (kw === 'input') return this.parseInputDef(desc)
    if (kw === 'schema') return this.parseSchema(desc)
    if (kw === 'directive') return this.parseDirectiveDef(desc)
    return this.parseObjectLike(kw, desc)
  }

  parseUnion(desc?: string): Node {
    const name = this.name()
    const directives = this.parseDirectives()
    const types: string[] = []
    if (this.is('=')) {
      this.next()
      if (this.is('|')) this.next()
      types.push(this.name())
      while (this.is('|')) {
        this.next()
        types.push(this.name())
      }
    }
    return { kind: 'UnionDef', desc, name, directives, types }
  }

  parseEnum(desc?: string): Node {
    const name = this.name()
    const directives = this.parseDirectives()
    const values: Node[] = []
    this.expect('{')
    while (!this.is('}')) {
      let vdesc: string | undefined
      if (this.peek().kind === 'string') vdesc = this.next().value
      values.push({ kind: 'EnumValueDef', desc: vdesc, name: this.name(), directives: this.parseDirectives() })
    }
    this.expect('}')
    return { kind: 'EnumDef', desc, name, directives, values }
  }

  parseInputDef(desc?: string): Node {
    const name = this.name()
    const directives = this.parseDirectives()
    const fields = this.is('{') ? this.parseInputFields(false) : []
    return { kind: 'InputDef', desc, name, directives, fields }
  }

  parseSchema(desc?: string): Node {
    const directives = this.parseDirectives()
    const ops: Node[] = []
    this.expect('{')
    while (!this.is('}')) {
      const opType = this.name()
      this.expect(':')
      ops.push({ kind: 'SchemaOp', operation: opType, type: this.name() })
    }
    this.expect('}')
    return { kind: 'SchemaDef', desc, directives, ops }
  }

  parseDirectiveDef(desc?: string): Node {
    this.expect('@')
    const name = this.name()
    const args = this.is('(') ? this.parseInputFields(true) : []
    let repeatable = false
    if (this.peek().kind === 'name' && this.peek().value === 'repeatable') {
      this.next()
      repeatable = true
    }
    this.expect('on')
    const locations: string[] = []
    if (this.is('|')) this.next()
    locations.push(this.name())
    while (this.is('|')) {
      this.next()
      locations.push(this.name())
    }
    return { kind: 'DirectiveDef', desc, name, args, repeatable, locations }
  }

  parseObjectLike(kw: string, desc?: string): Node {
    const name = this.name()
    const interfaces: string[] = []
    if (this.peek().kind === 'name' && this.peek().value === 'implements') {
      this.next()
      if (this.is('&')) this.next()
      interfaces.push(this.name())
      while (this.is('&')) {
        this.next()
        interfaces.push(this.name())
      }
    }
    const directives = this.parseDirectives()
    const fields: Node[] = []
    if (this.is('{')) {
      this.expect('{')
      while (!this.is('}')) fields.push(this.parseFieldDef())
      this.expect('}')
    }
    return { kind: kw === 'interface' ? 'InterfaceDef' : 'TypeDef', desc, name, interfaces, directives, fields }
  }

  parseFieldDef(): Node {
    let desc: string | undefined
    if (this.peek().kind === 'string') desc = this.next().value
    const name = this.name()
    const args = this.is('(') ? this.parseInputFields(true) : []
    this.expect(':')
    const type = this.parseType()
    return { kind: 'FieldDef', desc, name, args, type, directives: this.parseDirectives() }
  }

  parseInputFields(paren: boolean): Node[] {
    this.expect(paren ? '(' : '{')
    const out: Node[] = []
    while (!this.is(paren ? ')' : '}')) {
      let desc: string | undefined
      if (this.peek().kind === 'string') desc = this.next().value
      const name = this.name()
      this.expect(':')
      const type = this.parseType()
      let def: Node | undefined
      if (this.is('=')) {
        this.next()
        def = this.parseValue()
      }
      out.push({ kind: 'InputValueDef', desc, name, type, default: def, directives: this.parseDirectives() })
    }
    this.expect(paren ? ')' : '}')
    return out
  }
}

export function parseGraphql(src: string): Node {
  if (!src.trim()) throw new Error('請輸入 GraphQL')
  return new Parser(lex(src)).parseDocument()
}
