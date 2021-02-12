import {
  ComponentPlugin,
  FileType,
  ChunkType,
  HTMLComponentGeneratorError,
  HastNode,
} from '@teleporthq/teleport-types'
import { HASTBuilders, HASTUtils } from '@teleporthq/teleport-plugin-common'
import { StringUtils } from '@teleporthq/teleport-shared'

export const createHTMLImportStatementsPlugin = () => {
  const htmlImportsPlugin: ComponentPlugin = async (structure) => {
    const { dependencies = {}, chunks, uidl } = structure
    let chunkIndex = 0
    const htmlChunk = chunks.find((chunk, index) => {
      if (
        chunk.name === 'html-template' &&
        chunk.type === ChunkType.HAST &&
        chunk.fileType === FileType.HTML
      ) {
        chunkIndex = index
        return chunk
      }
    })
    if (!htmlChunk) {
      throw new HTMLComponentGeneratorError(
        `HTML Chunk is missing from the generated chunks from htmlImportsPlugin`
      )
    }
    const htmlTag = htmlChunk.content as HastNode

    if (Object.keys(dependencies).length === 0) {
      return structure
    }

    const headTag = HASTBuilders.createHTMLNode('head')
    Object.keys(dependencies).forEach((item) => {
      const dependency = dependencies[item]
      if (dependency.meta?.importJustPath) {
        if (dependency.path.endsWith('css')) {
          const linkTag = HASTBuilders.createHTMLNode('link')
          HASTUtils.addAttributeToNode(linkTag, 'href', dependency.path)
          HASTUtils.addAttributeToNode(linkTag, 'rel', 'stylesheet')
          HASTUtils.addChildNode(headTag, linkTag)
        } else {
          const scriptTag = HASTBuilders.createHTMLNode('script')
          HASTUtils.addAttributeToNode(scriptTag, 'type', 'text/javascript')
          HASTUtils.addAttributeToNode(scriptTag, 'src', dependency.path)
        }
      }
    })

    if (uidl?.seo) {
      const { metaTags = [], assets, title } = uidl.seo
      if (title) {
        const titleTag = HASTBuilders.createHTMLNode('title')
        HASTUtils.addTextNode(titleTag, StringUtils.encode(title))
        HASTUtils.addChildNode(headTag, titleTag)
      }

      if (metaTags.length > 0) {
        metaTags.forEach((meta) => {
          const metaTag = HASTBuilders.createHTMLNode('meta')
          Object.keys(meta).forEach((key) => {
            HASTUtils.addAttributeToNode(metaTag, key, meta[key])
          })
          HASTUtils.addChildNode(headTag, metaTag)
        })
      }

      if (assets && assets.length > 0) {
        assets.forEach((asset) => {
          if (asset.type === 'canonical' && asset.path) {
            const linkTag = HASTBuilders.createHTMLNode('link')
            HASTUtils.addAttributeToNode(linkTag, 'rel', 'canonical')
            HASTUtils.addAttributeToNode(linkTag, 'href', asset.path)
            HASTUtils.addChildNode(headTag, linkTag)
          }
        })
      }
    }

    htmlTag.children = [headTag, ...htmlTag.children]

    chunks.splice(chunkIndex, 1)
    chunks.push({
      ...htmlChunk,
      content: htmlTag,
    })

    return structure
  }

  return htmlImportsPlugin
}

export default createHTMLImportStatementsPlugin()
