import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TARGETS = ['app/pages', 'app/components', 'app/layouts']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.vue')) out.push(full)
  }
  return out
}

const files = TARGETS.flatMap((t) => {
  try {
    return walk(join(ROOT, t))
  } catch {
    return []
  }
})

let failed = 0

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const source = readFileSync(file, 'utf8')

  try {
    const { descriptor, errors } = parse(source, { filename: rel })
    if (errors.length) throw errors[0]

    const id = rel.replace(/[^a-z0-9]/gi, '')

    if (descriptor.script || descriptor.scriptSetup) {
      const compiled = compileScript(descriptor, { id })

      // Kompilyator makrosi kompilyatsiyadan keyin ham qolgan bo‘lsa, u ish
      // vaqtida chaqiriladi va ReferenceError beradi (odatda yopilmagan qavs).
      const leftover = ['defineProps', 'defineEmits', 'defineSlots', 'defineModel', 'defineExpose']
        .filter((m) => new RegExp(`(^|[^.\\w])${m}\\s*[<(]`).test(compiled.content))
      if (leftover.length) {
        throw new Error(`kompilyatsiyadan keyin makro qoldi: ${leftover.join(', ')}`)
      }
    }

    if (descriptor.template) {
      const res = compileTemplate({
        id,
        filename: rel,
        source: descriptor.template.content,
        compilerOptions: { bindingMetadata: {} },
      })
      if (res.errors.length) throw res.errors[0]
    }
  } catch (e) {
    failed++
    const loc = e?.loc?.start ? `:${e.loc.start.line}:${e.loc.start.column}` : ''
    console.log(`FAIL ${rel}${loc}\n     ${String(e.message ?? e).split('\n')[0]}`)
  }
}

console.log(`\n${files.length} ta SFC tekshirildi, ${failed} tasida xato.`)
process.exit(failed ? 1 : 0)
