import { ChainId } from '@sushiswap/chain'
import {
  currencyFromShortCurrencyName,
  isShortCurrencyName,
  isShortCurrencyNameSupported,
  nativeCurrencyIds,
  Token,
} from '@sushiswap/currency'
import { DataFetcher, Router } from '@sushiswap/router'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BigNumber, providers } from 'ethers'
import { getAddress } from 'ethers/lib/utils'
import { RequestInfo, RequestInit } from 'node-fetch'
import { z } from 'zod'

const fetch = (url: RequestInfo, init?: RequestInit) =>
  import('node-fetch').then(({ default: fetch }) => fetch(url, init))

const schema = z.object({
  chainId: z.coerce
    .number()
    .int()
    .gte(0)
    .lte(2 ** 256)
    .default(ChainId.ETHEREUM),
  fromTokenId: z.string().default(nativeCurrencyIds[ChainId.ETHEREUM]),
  toTokenId: z.string().default('SUSHI'),
  gasPrice: z.coerce.number().int().gte(1),
  amount: z.coerce.bigint(),
  to: z.string(),
})

export function getRouteProcessorAddressForChainId(chainId: ChainId) {
  switch (chainId) {
    case ChainId.ETHEREUM:
      return '0xf267704dD1393c26B39A6D41F49Bea233B34F722'
    case ChainId.POLYGON:
      return '0xf267704dD1393c26B39A6D41F49Bea233B34F722'
    default:
      throw new Error(`Unsupported route processor network for ${chainId}`)
  }
}

export function getAlchemyNetowrkForChainId(chainId: ChainId) {
  switch (chainId) {
    case ChainId.ETHEREUM:
      return 'homestead'
    case ChainId.POLYGON:
      return 'matic'
    case ChainId.POLYGON_TESTNET:
      return 'maticmum'
    case ChainId.ARBITRUM:
      return 'arbitrum'
    case ChainId.OPTIMISM:
      return 'optimism'
    case ChainId.GÖRLI:
      return 'goerli'
    default:
      throw new Error(`Unsupported eth alchemy network for ${chainId}`)
  }
}

const delay = async (ms: number) => new Promise((res) => setTimeout(res, ms))

class Waiter {
  resolved = false

  async wait() {
    while (!this.resolved) {
      await delay(500)
    }
  }

  resolve() {
    this.resolved = true
  }
}

const tokenSchema = z.object({
  address: z.coerce.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.coerce.number().int().gte(0),
})

const handler = async (request: VercelRequest, response: VercelResponse) => {
  // Serve from cache, but update it, if requested after 1 second.
  // response.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate')

  const { chainId, fromTokenId, toTokenId, amount, gasPrice } = schema.parse(request.query)

  const isShortNameSupported = isShortCurrencyNameSupported(chainId)
  const fromTokenIdIsShortName = isShortCurrencyName(chainId, fromTokenId)
  const toTokenIdIsShortName = isShortCurrencyName(chainId, toTokenId)

  // Limited to predefined short names and tokens from our db for now
  const fromToken =
    isShortNameSupported && fromTokenIdIsShortName
      ? currencyFromShortCurrencyName(chainId, fromTokenId)
      : new Token({
          chainId,
          ...tokenSchema.parse(
            await (await fetch(`https://tokens.sushi.com/v0/${chainId}/${getAddress(fromTokenId)}`)).json()
          ),
        })

  // Limited to predefined short names and tokens from our db for now
  const toToken =
    isShortNameSupported && toTokenIdIsShortName
      ? currencyFromShortCurrencyName(chainId, toTokenId)
      : new Token({
          chainId,
          ...tokenSchema.parse(
            await (await fetch(`https://tokens.sushi.com/v0/${chainId}/${getAddress(toTokenId)}`)).json()
          ),
        })

  const dataFetcher = new DataFetcher(
    new providers.AlchemyProvider(getAlchemyNetowrkForChainId(chainId), process.env['ALCHEMY_API_KEY']),
    chainId
  )
  dataFetcher.startDataFetching()
  dataFetcher.fetchPoolsForToken(fromToken, toToken)
  const waiter = new Waiter()
  const router = new Router(dataFetcher, fromToken, BigNumber.from(amount.toString()), toToken, gasPrice ?? 30e9)
  router.startRouting(() => {
    const printed = router.getCurrentRouteHumanString()
    console.log(printed)
    waiter.resolve()
  })
  await waiter.wait()
  router.stopRouting()
  dataFetcher.stopDataFetching()
  return response.status(200).json(router.getBestRoute())
}

export default handler
