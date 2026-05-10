---
title: A Two Column Arxiv Template
short_title: A Two Column Arxiv Template
description: A two column template suitable for arxiv preprint submissions, ported to texdown.
authors:
  - name: Brenhin Keller
    affiliation: Dartmouth College
    email: bkeller@university.edu
    orcid: 0000-0000-0000-0001
    is_corresponding: true
keywords: [tutorial, python, seismic, attributes]
abstract: >
  Morbi eu neque et enim euismod cursus sit amet sit amet elit: Fusce eget
  neque placerat, vehicula dui id, placerat velit. Proin pellentesque
  fermentum sollicitudin. Etiam egestas sed dolor rutrum faucibus. Nunc ac
  viverra justo. Vestibulum eget erat pretium sem blandit placerat
  ullamcorper nec velit. Aliquam orci enim, luctus tempor euismod a,
  aliquam in ex. Morbi ultrices sapien quis neque sagittis condimentum.
bibliography: refs.bib
output: paper.tex
---

# Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
fermentum massa nec lectus pulvinar, vitae tristique purus consectetur.

# Headings: first level {#sec:headings}

See Section \ref{sec:headings} for the structure used throughout.

## Headings: second level

Vivamus vehicula leo et urna fermentum, in convallis lectus mollis.

$$
\xi_{ij}(t) = \frac{\alpha_i(t) a^{w_t}_{ij} \beta_j(t+1) b^{v_{t+1}}_j(y_{t+1})}{\sum_{i=1}^{N} \sum_{j=1}^{N} \alpha_i(t) a^{w_t}_{ij} \beta_j(t+1) b^{v_{t+1}}_j(y_{t+1})}
$$

### Headings: third level

Maecenas at neque ac orci venenatis pharetra. Energy is $E = mc^2$ in
its simplest closed form.

# Examples of citations, figures, tables, references {#sec:others}

Phasellus dictum nibh ac justo congue, vitae luctus odio porta.
[@kour2014real; @kour2014fast] and see [@hadash2018estimate].

The documentation for `natbib` may be found at
<http://mirrors.ctan.org/macros/latex/contrib/natbib/natnotes.pdf>.

## Figures

See Figure \ref{fig:fig1}.

![Sample figure caption.\label{fig:fig1}](placeholder.png){width=4cm}

## Lists

- Lorem ipsum dolor sit amet
- consectetur adipiscing elit
- Aliquam dignissim blandit est, in dictum tortor gravida eget.
