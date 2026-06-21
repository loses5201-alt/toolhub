/*
  GraphQL 輸出 —— 把 AST 重新印成 pretty(2 空白縮排)或 minify(壓縮)。
  純函式、無 DOM。每個印製函式的「第一行」不含縮排(由呼叫端定位),
  續行則自行補上對應層級縮排,以正確處理巢狀選擇集合。
*/
import type { Node } from './parse'

export interface PrintOptions {
  minify?: boolean
}

export function printGraphql(ast: Node, options: PrintOptions = {}): string {
  const minify = !!options.minify
  const SP = minify ? '' : ' '
  const COLON = minify ? ':' : ': '
  const SEP = minify ? ' ' : ', '
  const EQ = minify ? '=' : ' = '
  const ind = (level: number) => (minify ? '' : '  '.repeat(level))

  const str = (s: string) =>
    '"' +
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') +
    '"'

  const arr = (x: unknown) => (x as Node[]) || []

  function value(v: Node): string {
    switch (v.kind) {
      case 'Int':
      case 'Float':
      case 'Boolean':
      case 'Enum':
        return String(v.value)
      case 'Null':
        return 'null'
      case 'String':
        return str(String(v.value))
      case 'Variable':
        return '$' + v.name
      case 'ListValue':
        return '[' + arr(v.items).map(value).join(SEP) + ']'
      case 'ObjectValue':
        return '{' + arr(v.fields).map((f) => f.name + COLON + value(f.value as Node)).join(SEP) + '}'
    }
    return ''
  }

  function type(t: Node): string {
    if (t.kind === 'NamedType') return String(t.name)
    if (t.kind === 'ListType') return '[' + type(t.type as Node) + ']'
    if (t.kind === 'NonNull') return type(t.type as Node) + '!'
    return ''
  }

  function args(list: Node[]): string {
    if (!list.length) return ''
    return '(' + list.map((a) => a.name + COLON + value(a.value as Node)).join(SEP) + ')'
  }

  function directives(list: Node[]): string {
    return list.map((d) => SP + '@' + d.name + args(arr(d.args))).join('')
  }

  function varDefs(list: Node[]): string {
    return (
      '(' +
      list
        .map(
          (v) =>
            '$' + v.name + COLON + type(v.type as Node) + (v.default !== undefined ? EQ + value(v.default as Node) : '') + directives(arr(v.directives)),
        )
        .join(SEP) +
      ')'
    )
  }

  function selectionSet(set: Node, level: number): string {
    const sels = arr(set.selections)
    if (minify) return '{' + sels.map((s) => selection(s, level)).join(' ') + '}'
    return '{\n' + sels.map((s) => ind(level + 1) + selection(s, level + 1)).join('\n') + '\n' + ind(level) + '}'
  }

  function selection(s: Node, level: number): string {
    if (s.kind === 'FragmentSpread') return '...' + s.name + directives(arr(s.directives))
    if (s.kind === 'InlineFragment') {
      const head = '...' + (s.typeCondition ? ' on ' + s.typeCondition : '') + directives(arr(s.directives))
      return head + SP + selectionSet(s.selectionSet as Node, level)
    }
    // Field
    const alias = s.alias ? s.alias + COLON : ''
    const tail = s.selectionSet ? SP + selectionSet(s.selectionSet as Node, level) : ''
    return alias + s.name + args(arr(s.args)) + directives(arr(s.directives)) + tail
  }

  function descLine(d: unknown, level: number): string {
    if (typeof d !== 'string') return ''
    return minify ? str(d) : str(d) + '\n' + ind(level)
  }

  function block(items: Node[], fn: (n: Node, lvl: number) => string, level: number): string {
    if (minify) return '{' + items.map((it) => fn(it, level)).join(' ') + '}'
    return '{\n' + items.map((it) => ind(level + 1) + fn(it, level + 1)).join('\n') + '\n' + ind(level) + '}'
  }

  function inputFields(list: Node[]): string {
    return (
      '(' +
      list
        .map(
          (iv) =>
            (typeof iv.desc === 'string' ? str(iv.desc) + ' ' : '') +
            iv.name +
            COLON +
            type(iv.type as Node) +
            (iv.default !== undefined ? EQ + value(iv.default as Node) : '') +
            directives(arr(iv.directives)),
        )
        .join(SEP) +
      ')'
    )
  }

  function inputValueLine(iv: Node, level: number): string {
    return (
      descLine(iv.desc, level) +
      iv.name +
      COLON +
      type(iv.type as Node) +
      (iv.default !== undefined ? EQ + value(iv.default as Node) : '') +
      directives(arr(iv.directives))
    )
  }

  function fieldDef(fd: Node, level: number): string {
    const a = arr(fd.args).length ? inputFields(arr(fd.args)) : ''
    return descLine(fd.desc, level) + fd.name + a + COLON + type(fd.type as Node) + directives(arr(fd.directives))
  }

  function defBody(node: Node, level: number): string {
    switch (node.kind) {
      case 'Operation':
        if (node.shorthand) return selectionSet(node.selectionSet as Node, level)
        return (
          String(node.operation) +
          (node.name ? ' ' + node.name : '') +
          (arr(node.vars).length ? varDefs(arr(node.vars)) : '') +
          directives(arr(node.directives)) +
          SP +
          selectionSet(node.selectionSet as Node, level)
        )
      case 'FragmentDef':
        return (
          'fragment ' + node.name + ' on ' + node.typeCondition + directives(arr(node.directives)) + SP + selectionSet(node.selectionSet as Node, level)
        )
      case 'ScalarDef':
        return 'scalar ' + node.name + directives(arr(node.directives))
      case 'UnionDef': {
        const types = node.types as string[]
        const eq = types.length ? EQ + types.join(minify ? '|' : ' | ') : ''
        return 'union ' + node.name + directives(arr(node.directives)) + eq
      }
      case 'EnumDef':
        return (
          'enum ' +
          node.name +
          directives(arr(node.directives)) +
          SP +
          block(arr(node.values), (v, l) => descLine(v.desc, l) + v.name + directives(arr(v.directives)), level)
        )
      case 'InputDef':
        return (
          'input ' +
          node.name +
          directives(arr(node.directives)) +
          (arr(node.fields).length ? SP + block(arr(node.fields), inputValueLine, level) : '')
        )
      case 'SchemaDef':
        return (
          'schema' + directives(arr(node.directives)) + SP + block(arr(node.ops), (o) => o.operation + COLON + o.type, level)
        )
      case 'DirectiveDef':
        return (
          'directive @' +
          node.name +
          (arr(node.args).length ? inputFields(arr(node.args)) : '') +
          (node.repeatable ? ' repeatable' : '') +
          ' on ' +
          (node.locations as string[]).join(minify ? '|' : ' | ')
        )
      case 'TypeDef':
      case 'InterfaceDef': {
        const kw = node.kind === 'InterfaceDef' ? 'interface ' : 'type '
        const impl = (node.interfaces as string[]).length
          ? ' implements ' + (node.interfaces as string[]).join(minify ? '&' : ' & ')
          : ''
        const head = kw + node.name + impl + directives(arr(node.directives))
        return head + (arr(node.fields).length ? SP + block(arr(node.fields), fieldDef, level) : '')
      }
    }
    return ''
  }

  function definition(node: Node, level: number): string {
    return descLine(node.desc, level) + defBody(node, level)
  }

  const defs = arr(ast.definitions)
  return defs.map((d) => definition(d, 0)).join(minify ? ' ' : '\n\n')
}
