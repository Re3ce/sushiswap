import { ChainId } from '@sushiswap/chain'
import { Token } from '@sushiswap/currency'
import { useQuery } from '@tanstack/react-query'

interface UseTokensParams {
  chainId: ChainId
}

type Data = Array<{
  id: string
  address: string
  name: string
  symbol: string
  decimals: number
}>

const BLACKLIST: Record<number, string[]> = {
  [ChainId.OPTIMISM]: ['0x0000000000000000000000000000000000000000', '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000'],
}

export const useTokens = ({ chainId }: UseTokensParams) => {
  return useQuery({
    queryKey: ['tokens', { chainId }],
    queryFn: async () => {
      const res = await fetch(`https://tokens.sushi.com/v0/${chainId}`)
      const data: Data = await res.json()
      return data.reduce<Record<string, Token>>((acc, { address, id, name, symbol, decimals }) => {
        const [chainId] = id.split(':')

        if (!BLACKLIST[+chainId]?.includes(address)) {
          acc[address] = new Token({
            chainId,
            name,
            decimals,
            symbol,
            address,
          })
        }
        return acc
      }, {})
    },
  })
}
