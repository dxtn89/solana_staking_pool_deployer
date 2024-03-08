# Staking on Solana

This project is a Solana program written in Rust using the Anchor framework. It demonstrates a basic staking mechanism where users can stake Solana tokens into a pool.

## Features

- **Initialize Pool**: Set up a new staking pool with a total staked balance of zero.
- **Stake Tokens**: Allows users to stake tokens into the pool.

## Requirements

- Rust
- Solana CLI
- Anchor Framework

## Installation

First, ensure you have Rust, Solana CLI, and Anchor installed on your machine. Follow the instructions on the official websites to install these prerequisites:

- Rust: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
- Solana CLI: [https://docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools)
- Anchor: [https://project-serum.github.io/anchor/getting-started/installation.html](https://project-serum.github.io/anchor/getting-started/installation.html)

After installing the prerequisites, clone this repository to your local machine:

```bash
git clone <repository-url>
cd staking-on-solana
```

## Quick Start

1. **Build the project:**

    ```bash
    anchor build
    ```

2. **Test the project:**

    Then, in a separate terminal window, run the tests:

    ```bash
    anchor test
    ```
